"""
Course Generation Module for Personalized Upskilling Pathways.

Uses Groq API to generate structured learning courses based on
a candidate's current skills, missing skills, and target role.
Ported from ai_course_gen with resume-aware prompt engineering.
"""

import os
import json
import re
import logging
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "llama-3.1-8b-instant"

SYSTEM_MSG = (
    "You are an expert career coach and course creator. "
    "Return ONLY valid JSON. No preamble. No markdown. No conversational text."
)


# ─── Groq API Call ──────────────────────────────────────────────

async def _call_groq(prompt: str, max_tokens: int = 4096) -> str:
    """Call Groq API for text generation."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set")

    endpoint = f"{GROQ_API_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_MSG},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        "max_tokens": max_tokens,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(3):
            try:
                response = await client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < 2:
                    import asyncio
                    await asyncio.sleep(2 * (attempt + 1))
                else:
                    raise

    raise ValueError("Groq API call failed after retries")


# ─── JSON Parsing (from ai_course_gen) ──────────────────────────

def _parse_json_response(text: str) -> dict:
    """Parse JSON from AI response, handling common formatting issues."""
    text = text.strip()

    # Remove markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Find JSON start
    json_start = -1
    for i, ch in enumerate(text):
        if ch in ('{', '['):
            json_start = i
            break

    if json_start < 0:
        raise ValueError(f"No JSON found in response: {text[:200]}")

    text = text[json_start:]

    # Try direct parse
    try:
        result = json.loads(text)
        if isinstance(result, list) and len(result) > 0 and isinstance(result[0], dict):
            return result[0]
        return result
    except json.JSONDecodeError:
        pass

    # Try repair: close brackets
    ob = text.count('{') - text.count('}')
    obr = text.count('[') - text.count(']')
    candidate = text + ']' * max(0, obr) + '}' * max(0, ob)
    try:
        result = json.loads(candidate)
        if isinstance(result, list) and len(result) > 0:
            return result[0]
        return result
    except json.JSONDecodeError:
        pass

    # Try trimming to last complete brace
    last_brace = text.rfind('}')
    if last_brace > 0:
        candidate = text[:last_brace + 1]
        ob2 = candidate.count('{') - candidate.count('}')
        obr2 = candidate.count('[') - candidate.count(']')
        candidate = candidate + ']' * max(0, obr2) + '}' * max(0, ob2)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from response: {text[:200]}")


# ─── Prompt Templates ──────────────────────────────────────────

UPSKILL_COURSE_PROMPT = """
Create a personalized upskilling course for someone who wants to become a **{target_role}**.

**Current Skills**: {current_skills}
**Skills They Need to Learn**: {missing_skills}

Structure the course as a week-by-week curriculum (4-16 weeks depending on the skill gap).
Focus on bridging the gap between their current skills and the target role requirements.

Return JSON:
{{
  "title": "Course Name",
  "description": "Short overview of the learning path",
  "target_role": "{target_role}",
  "estimated_weeks": 8,
  "prerequisites": ["Skill 1", "Skill 2"],
  "weeks": [
    {{
      "week": 1,
      "title": "Week Title",
      "concepts": ["Topic 1", "Topic 2"],
      "focus": "theory"
    }}
  ]
}}

RULES:
1. "prerequisites" MUST be a list of strings.
2. "concepts" MUST be a list of strings.
3. Focus weeks on the MISSING skills, not skills they already have.
4. Start with foundational missing skills, progress to advanced ones.
5. Output VALID JSON ONLY.
"""

WEEK_DETAILS_PROMPT = """
Generate a daily breakdown for Week {week_number}: "{week_title}" of an upskilling course.
Target Role: {target_role}
Concepts to cover: {concepts}

Return JSON:
{{
  "days": [
    {{
      "day": 1,
      "title": "Day Topic",
      "task_type": "theory",
      "duration_minutes": 60,
      "concepts": ["Concept A", "Concept B"]
    }}
  ]
}}

RULES:
1. Generate 5-6 days for this week.
2. Each day has 2-4 concepts.
3. Mix theory, practice, and project work.
4. JSON ONLY.
"""

DAY_DETAILS_PROMPT = """
Generate learning content for Day {day_number}: "{day_title}".

**Target Role**: {target_role}
**Type**: {task_type} ({duration_minutes} min)

Return JSON:
{{
  "title": "{day_title}",
  "description": "Clear educational explanation of the topic with practical guidance.",
  "table_of_contents": ["Topic 1", "Topic 2", "Topic 3"],
  "resources": [
    {{ "title": "Search Query for YouTube", "source": "youtube" }},
    {{ "title": "Search Query for Web", "source": "web" }}
  ]
}}

RULES:
1. Description should be helpful and actionable.
2. Provide 3-5 search queries for resources.
3. JSON ONLY.
"""


# ─── Course Generation Functions ────────────────────────────────

async def generate_upskill_course(
    current_skills: list[str],
    missing_skills: list[str],
    target_role: str,
) -> dict:
    """Generate a personalized upskilling course outline."""
    prompt = UPSKILL_COURSE_PROMPT.format(
        target_role=target_role,
        current_skills=", ".join(current_skills) if current_skills else "None specified",
        missing_skills=", ".join(missing_skills) if missing_skills else "General skills for role",
    )

    logger.info(f"Generating course for role: {target_role}")
    raw = await _call_groq(prompt)
    data = _parse_json_response(raw)

    # Ensure required fields
    data.setdefault("prerequisites", [])
    data.setdefault("weeks", [])
    data.setdefault("target_role", target_role)

    for w in data["weeks"]:
        w.setdefault("concepts", [])
        w.setdefault("focus", "theory")

    data["estimated_weeks"] = len(data["weeks"])
    return data


async def generate_course_week_details(
    target_role: str,
    week_number: int,
    week_title: str,
    concepts: list[str],
) -> dict:
    """Generate daily breakdown for a specific week."""
    concepts_str = ", ".join(concepts) if concepts else week_title

    prompt = WEEK_DETAILS_PROMPT.format(
        target_role=target_role,
        week_number=week_number,
        week_title=week_title,
        concepts=concepts_str,
    )

    logger.info(f"Generating Week {week_number}: {week_title}")
    raw = await _call_groq(prompt)
    data = _parse_json_response(raw)

    data.setdefault("days", [])
    for day in data["days"]:
        day.setdefault("concepts", [])
        day["is_generated"] = True

    return data


async def generate_course_day_details(
    target_role: str,
    day_title: str,
    day_number: int,
    task_type: str = "theory",
    duration_minutes: int = 60,
) -> dict:
    """Generate details for a specific day and enrich with resources."""
    prompt = DAY_DETAILS_PROMPT.format(
        target_role=target_role,
        day_title=day_title,
        day_number=day_number,
        task_type=task_type,
        duration_minutes=duration_minutes,
    )

    logger.info(f"Generating Day {day_number}: {day_title}")
    raw = await _call_groq(prompt)
    data = _parse_json_response(raw)

    # Enrich resources with actual YouTube / web results
    if "resources" in data:
        try:
            from resource_search import search_youtube, search_web

            final_resources = []
            for r in data["resources"][:4]:
                q = r.get("title", day_title)
                if r.get("source") == "youtube":
                    res = await search_youtube(q + " tutorial")
                    if res:
                        final_resources.append(res[0])
                else:
                    res = await search_web(q + " tutorial")
                    if res:
                        final_resources.append(res[0])

            data["resources"] = final_resources
        except Exception as e:
            logger.warning(f"Resource enrichment failed: {e}")

    return data
