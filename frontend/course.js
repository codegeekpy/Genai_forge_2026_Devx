/**
 * Course Recommendations Frontend
 * Fetches role recommendations and generates learning paths via Groq.
 */

const API_BASE = "http://localhost:8000";

let currentResumeId = null;
let recommendationsData = null;

/* ───── Init ───── */
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resume_id");

    if (resumeId) {
        currentResumeId = parseInt(resumeId);
        loadRecommendations();
    } else {
        showNoResumeState();
    }
});

/* ───── Load Recommendations ───── */
async function loadRecommendations() {
    if (!currentResumeId) {
        const input = document.getElementById("resumeIdInput");
        if (input && input.value) {
            currentResumeId = parseInt(input.value);
        }
    }

    if (!currentResumeId) {
        showError("Please enter a valid Resume ID.");
        return;
    }

    showLoading();

    try {
        const response = await fetch(
            `${API_BASE}/api/recommend-roles/${currentResumeId}?top_k=5`,
            { method: 'POST' }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to get recommendations");
        }

        recommendationsData = await response.json();
        renderRecommendations(recommendationsData);
    } catch (error) {
        showError(error.message);
    }
}

/* ───── Render Recommendations ───── */
function renderRecommendations(data) {
    hideAll();

    // Skills summary
    const skillsSummary = document.getElementById("skillsSummary");
    const currentSkillsList = document.getElementById("currentSkillsList");
    const skills = data.candidate_skills || [];
    currentSkillsList.innerHTML = skills
        .map((s) => `<span class="skill-tag has">${esc(s)}</span>`)
        .join("");
    skillsSummary.style.display = "block";

    // Role cards
    const roleCardsList = document.getElementById("roleCardsList");
    const recommendations = data.recommendations || [];
    roleCardsList.innerHTML = recommendations
        .map((role, i) => renderRoleCard(role, i))
        .join("");
    document.getElementById("roleCards").style.display = "block";
}

function renderRoleCard(role, index) {
    const rank = index + 1;
    const matchScore = Math.round(role.match_score || 0);
    const scoreClass =
        matchScore >= 70 ? "high" : matchScore >= 40 ? "mid" : "low";

    const matchingSkills = role.matching_skills || [];
    const missingSkills = role.missing_skills || [];
    const salary = role.salary_range || {};
    const roleName = role.role_name || "Unknown Role";

    return `
    <div class="role-card" id="role-card-${index}">
        <div class="role-card-top">
            <div class="role-rank-strip">
                <span>#${rank}</span>
                <span class="role-rank-label">Rank</span>
            </div>
            <div class="role-info-area">
                <div class="role-name-main">${esc(roleName)}</div>
                <div class="role-category-text">${esc(role.category || "")}</div>
            </div>
            <div class="role-match-badge">
                <div class="match-pct ${scoreClass}">${matchScore}%</div>
                <div class="match-pct-label">Match</div>
            </div>
        </div>

        <div class="role-skills-area">
            ${matchingSkills.length > 0
            ? `<div class="role-skills-row">
                    <div class="skills-label match-lbl">Matching Skills (${matchingSkills.length})</div>
                    <div class="skill-tag-list">${matchingSkills.map((s) => `<span class="skill-tag has">${esc(s)}</span>`).join("")}</div>
                </div>`
            : ""
        }
            ${missingSkills.length > 0
            ? `<div class="role-skills-row">
                    <div class="skills-label missing-lbl">Skills to Learn (${missingSkills.length})</div>
                    <div class="skill-tag-list">${missingSkills.map((s) => `<span class="skill-tag missing">${esc(s)}</span>`).join("")}</div>
                </div>`
            : ""
        }
        </div>

        <div class="role-card-bottom">
            <div class="salary-text">
                ${salary.min && salary.max
            ? `<strong>${salary.min} &ndash; ${salary.max} LPA</strong>`
            : ""
        }
            </div>
            <button class="gen-course-btn" id="gen-btn-${index}"
                onclick="generateCourse(${index}, '${escAttr(roleName)}')">
                <span class="btn-label">Generate Learning Path</span>
                <span class="btn-loading-label">Generating...</span>
                <span class="btn-spinner-sm"></span>
            </button>
        </div>
    </div>`;
}

/* ───── Generate Course ───── */
async function generateCourse(index, targetRole) {
    const btn = document.getElementById(`gen-btn-${index}`);
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE}/api/generate-course/${currentResumeId}?target_role=${encodeURIComponent(targetRole)}`,
            { method: "POST" }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to generate course");
        }

        const data = await response.json();
        showCourseDialog(data, targetRole);
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

/* ───── Course Dialog ───── */
function showCourseDialog(data, targetRole) {
    const overlay = document.getElementById("courseOverlay");
    const content = document.getElementById("courseContent");
    const title = document.getElementById("courseDialogTitle");
    const course = data.course || {};

    title.textContent = course.title || `Learning Path: ${targetRole}`;

    content.innerHTML = `
        <p class="course-desc">${esc(course.description || "")}</p>

        <div class="course-meta-row">
            <span class="meta-pill">Target: ${esc(targetRole)}</span>
            <span class="meta-pill">${course.estimated_weeks || course.weeks?.length || 0} Weeks</span>
            ${(data.current_skills || []).length > 0 ? `<span class="meta-pill">${data.current_skills.length} Current Skills</span>` : ""}
            ${(data.missing_skills || []).length > 0 ? `<span class="meta-pill">${data.missing_skills.length} Skills to Learn</span>` : ""}
        </div>

        ${course.prerequisites && course.prerequisites.length > 0
            ? `<div class="prereq-section">
                    <h4>Prerequisites</h4>
                    <div class="skill-tag-list">${course.prerequisites.map((p) => `<span class="concept-chip">${esc(p)}</span>`).join("")}</div>
                </div>`
            : ""
        }

        <div class="weeks-list">
            ${(course.weeks || []).map((w, i) => renderWeekRow(w, i, targetRole)).join("")}
        </div>
    `;

    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeCourse() {
    document.getElementById("courseOverlay").style.display = "none";
    document.body.style.overflow = "";
}

/* ───── Week Row ───── */
function renderWeekRow(week, index, targetRole) {
    const focusMap = {
        theory: "tag-theory",
        practice: "tag-practice",
        project: "tag-project",
        review: "tag-review",
    };
    const focusClass = focusMap[(week.focus || "theory").toLowerCase()] || "tag-theory";
    const concepts = week.concepts || [];

    return `
    <div class="week-row" id="week-${index}">
        <div class="week-row-header"
            onclick="toggleWeek(${index}, '${escAttr(week.title || "")}', '${escAttr(JSON.stringify(concepts))}', '${escAttr(targetRole)}')">
            <div class="week-num">${week.week || index + 1}</div>
            <div class="week-row-title">${esc(week.title || `Week ${index + 1}`)}</div>
            <span class="week-focus-tag ${focusClass}">${esc(week.focus || "theory")}</span>
            <span class="week-expand-arrow">&#9660;</span>
        </div>
        ${concepts.length > 0
            ? `<div class="week-concepts-row">${concepts.map((c) => `<span class="concept-chip">${esc(c)}</span>`).join("")}</div>`
            : ""
        }
        <div class="week-details-area" id="week-details-${index}"></div>
    </div>`;
}

async function toggleWeek(index, weekTitle, conceptsJson, targetRole) {
    const row = document.getElementById(`week-${index}`);
    const details = document.getElementById(`week-details-${index}`);

    if (row.classList.contains("expanded")) {
        row.classList.remove("expanded");
        return;
    }

    row.classList.add("expanded");

    if (details.dataset.loaded === "true") return;

    details.innerHTML = `<div class="week-loading"><div class="loading-spinner" style="width:24px;height:24px;margin:0 auto 8px;"></div>Loading daily breakdown...</div>`;

    try {
        let concepts = [];
        try { concepts = JSON.parse(conceptsJson); } catch (e) { }

        const response = await fetch(`${API_BASE}/api/generate-course-week`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                target_role: targetRole,
                week_number: index + 1,
                week_title: weekTitle,
                concepts: concepts,
            }),
        });

        if (!response.ok) throw new Error("Failed to load week details");

        const data = await response.json();
        const days = data.days || [];

        details.innerHTML = days
            .map((day, i) => renderDayRow(day, index, i, targetRole))
            .join("");
        details.dataset.loaded = "true";
    } catch (error) {
        details.innerHTML = `<div class="week-loading" style="color:#a8201a;">${error.message}</div>`;
    }
}

/* ───── Day Row ───── */
function renderDayRow(day, weekIndex, dayIndex, targetRole) {
    const focusMap = {
        theory: "tag-theory",
        practice: "tag-practice",
        project: "tag-project",
        review: "tag-review",
    };
    const typeClass = focusMap[(day.task_type || "theory").toLowerCase()] || "tag-theory";

    return `
    <div class="day-row" id="day-${weekIndex}-${dayIndex}">
        <div class="day-row-header"
            onclick="toggleDay(${weekIndex}, ${dayIndex}, '${escAttr(day.title || "")}', ${day.day || dayIndex + 1}, '${escAttr(day.task_type || "theory")}', ${day.duration_minutes || 60}, '${escAttr(targetRole)}')">
            <span class="day-title-text">Day ${day.day || dayIndex + 1}: ${esc(day.title || "")}</span>
            <div class="day-tags">
                <span class="day-type-tag ${typeClass}">${esc(day.task_type || "theory")}</span>
                <span class="day-dur">${day.duration_minutes || 60} min</span>
            </div>
        </div>
        <div class="day-detail-area" id="day-detail-${weekIndex}-${dayIndex}"></div>
    </div>`;
}

async function toggleDay(weekIndex, dayIndex, dayTitle, dayNumber, taskType, duration, targetRole) {
    const row = document.getElementById(`day-${weekIndex}-${dayIndex}`);
    const detail = document.getElementById(`day-detail-${weekIndex}-${dayIndex}`);

    if (row.classList.contains("expanded")) {
        row.classList.remove("expanded");
        return;
    }

    row.classList.add("expanded");

    if (detail.dataset.loaded === "true") return;

    detail.innerHTML = `<div class="week-loading" style="padding:16px;"><div class="loading-spinner" style="width:20px;height:20px;margin:0 auto 6px;"></div>Loading content...</div>`;
    detail.style.display = "block";

    try {
        const response = await fetch(`${API_BASE}/api/generate-course-day`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                target_role: targetRole,
                day_title: dayTitle,
                day_number: dayNumber,
                task_type: taskType,
                duration_minutes: duration,
            }),
        });

        if (!response.ok) throw new Error("Failed to load day details");

        const data = await response.json();
        detail.innerHTML = renderDayDetail(data);
        detail.dataset.loaded = "true";
    } catch (error) {
        detail.innerHTML = `<div class="week-loading" style="color:#a8201a;padding:16px;">${error.message}</div>`;
    }
}

function renderDayDetail(data) {
    const toc = data.table_of_contents || [];
    const resources = data.resources || [];

    return `
        <p class="day-desc">${esc(data.description || "")}</p>

        ${toc.length > 0
            ? `<div class="day-toc-section">
                    <h5>Topics Covered</h5>
                    <ul>${toc.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
                </div>`
            : ""
        }

        ${resources.length > 0
            ? `<div class="resources-section">
                    <h5>Resources</h5>
                    ${resources
                .map(
                    (r) => `
                        <a href="${escAttr(r.url || "#")}" target="_blank" rel="noopener" class="resource-row">
                            ${r.thumbnail ? `<img src="${escAttr(r.thumbnail)}" class="resource-thumb-img" onerror="this.style.display='none'">` : ""}
                            <div class="resource-info-box">
                                <div class="resource-title-text">${esc(r.title || "Resource")}</div>
                                <div class="resource-src ${r.source === "youtube" ? "yt" : "web"}">${r.source === "youtube" ? "YouTube" : "Web Article"}</div>
                            </div>
                        </a>`
                )
                .join("")}
                </div>`
            : ""
        }
    `;
}

/* ───── UI Helpers ───── */
function showLoading() {
    hideAll();
    document.getElementById("loadingState").style.display = "block";
}

function showError(message) {
    hideAll();
    document.getElementById("errorMessage").textContent = message;
    document.getElementById("errorState").style.display = "block";
}

function showNoResumeState() {
    hideAll();
    document.getElementById("noResumeState").style.display = "block";
}

function hideAll() {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("errorState").style.display = "none";
    document.getElementById("noResumeState").style.display = "none";
    document.getElementById("skillsSummary").style.display = "none";
    document.getElementById("roleCards").style.display = "none";
}

function esc(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

function escAttr(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/'/g, "&#39;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
