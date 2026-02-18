/**
 * Course Generation Frontend
 * Fetches role recommendations and allows users to generate learning paths.
 */

const API_BASE = "http://localhost:8000";

// State
let currentResumeId = null;
let recommendationsData = null;

// ───── Init ─────
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

// ───── Load Recommendations ─────
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
        const response = await fetch(`${API_BASE}/api/recommend-roles/${currentResumeId}?top_k=5`);

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

// ───── Render Recommendations ─────
function renderRecommendations(data) {
    hideAll();

    // Show skills summary
    const skillsSummary = document.getElementById("skillsSummary");
    const currentSkillsList = document.getElementById("currentSkillsList");

    const skills = data.candidate_skills || [];
    currentSkillsList.innerHTML = skills
        .map(s => `<span class="skill-tag has">${escapeHtml(s)}</span>`)
        .join("");
    skillsSummary.style.display = "block";

    // Render role cards
    const roleCardsList = document.getElementById("roleCardsList");
    const recommendations = data.recommendations || [];

    roleCardsList.innerHTML = recommendations
        .map((role, index) => renderRoleCard(role, index))
        .join("");

    document.getElementById("roleCards").style.display = "block";
}

function renderRoleCard(role, index) {
    const rank = index + 1;
    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const medal = medals[index] || `#${rank}`;
    const matchScore = Math.round((role.match_score || 0) * 100);

    const scoreClass = matchScore >= 70 ? "score-high" : matchScore >= 40 ? "score-mid" : "score-low";

    const matchingSkills = role.matching_skills || [];
    const missingSkills = role.missing_skills || [];
    const salary = role.salary_range || {};
    const roleName = role.role_name || "Unknown Role";

    return `
    <div class="role-card" id="role-card-${index}">
        <div class="role-card-header">
            <div class="role-info">
                <div class="role-rank">${medal} Rank #${rank}</div>
                <div class="role-name">${escapeHtml(roleName)}</div>
                <div class="role-category">${escapeHtml(role.category || "")}</div>
            </div>
            <div class="match-score">
                <div class="score-circle ${scoreClass}">${matchScore}%</div>
                <div class="score-label">Match</div>
            </div>
        </div>

        <div class="role-skills">
            ${matchingSkills.length > 0 ? `
            <div class="role-skills-section">
                <h4 class="match-label">✅ Matching Skills (${matchingSkills.length})</h4>
                <div class="skill-tags">
                    ${matchingSkills.map(s => `<span class="skill-tag has">${escapeHtml(s)}</span>`).join("")}
                </div>
            </div>
            ` : ""}
            ${missingSkills.length > 0 ? `
            <div class="role-skills-section">
                <h4 class="missing-label">❌ Skills to Learn (${missingSkills.length})</h4>
                <div class="skill-tags">
                    ${missingSkills.map(s => `<span class="skill-tag missing">${escapeHtml(s)}</span>`).join("")}
                </div>
            </div>
            ` : ""}
        </div>

        <div class="role-card-footer">
            <div class="salary-info">
                ${salary.min && salary.max
            ? `💰 <strong>₹${salary.min} - ₹${salary.max} LPA</strong>`
            : ""}
            </div>
            <button class="generate-course-btn" onclick="generateCourse(${index}, '${escapeAttr(roleName)}')" id="gen-btn-${index}">
                <span class="btn-text">🎯 Generate Learning Path</span>
                <span class="btn-loading-text">Generating...</span>
                <span class="btn-spinner"></span>
            </button>
        </div>

        <div id="course-inline-${index}" class="course-inline" style="display:none;"></div>
    </div>`;
}

// ───── Generate Course ─────
async function generateCourse(index, targetRole) {
    const btn = document.getElementById(`gen-btn-${index}`);
    btn.classList.add("loading");
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/generate-course/${currentResumeId}?target_role=${encodeURIComponent(targetRole)}`, {
            method: "POST",
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to generate course");
        }

        const data = await response.json();

        // Fetch career progression separately to enrich the data
        try {
            const progResponse = await fetch(`${API_BASE}/api/career-progression/${currentResumeId}`, {
                method: "POST"
            });
            if (progResponse.ok) {
                const progData = await progResponse.json();
                data.progression = progData;
            }
        } catch (e) {
            console.warn("Career progression failed to load", e);
        }

        showCourseModal(data, targetRole);
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.classList.remove("loading");
        btn.disabled = false;
    }
}

// ───── Show Course Modal ─────
function showCourseModal(data, targetRole) {
    const overlay = document.getElementById("courseOverlay");
    const content = document.getElementById("courseContent");
    const course = data.course || {};
    const progression = data.progression || null;

    content.innerHTML = `
        <div class="course-header">
            <h2>📚 ${escapeHtml(course.title || `Learning Path for ${targetRole}`)}</h2>
            <p>${escapeHtml(course.description || "")}</p>
            <div class="course-meta">
                <span class="meta-badge">🎯 ${escapeHtml(targetRole)}</span>
                <span class="meta-badge">📅 ${course.estimated_weeks || course.weeks?.length || 0} Weeks</span>
                ${(data.current_skills || []).length > 0
            ? `<span class="meta-badge">✅ ${data.current_skills.length} Current Skills</span>` : ""}
                ${(data.missing_skills || []).length > 0
            ? `<span class="meta-badge">📖 ${data.missing_skills.length} Skills to Learn</span>` : ""}
            </div>
        </div>

        ${progression && progression.next_steps && progression.next_steps.length > 0 ? `
        <div class="progression-section">
            <h3 class="progression-title">🚀 Your Career Roadmap: Next Steps</h3>
            <div class="progression-path">
                <div class="progression-node current">
                    <div class="node-label">Current / Target</div>
                    <div class="node-value">${escapeHtml(progression.current_role || targetRole)}</div>
                </div>
                <div class="progression-arrow">→</div>
                ${progression.next_steps.map(step => `
                    <div class="progression-node next">
                        <div class="node-label">Promotion Path</div>
                        <div class="node-value">${escapeHtml(step.role_name)}</div>
                        <div class="node-salary">${escapeHtml(step.salary_band)}</div>
                    </div>
                `).join('<div class="progression-arrow">→</div>')}
            </div>
            <div class="progression-skills-needed">
                <strong>Skills to master for next level:</strong>
                <div class="skill-tags">
                    ${progression.next_steps[0].skills_needed.map(s => `<span class="skill-tag missing">${escapeHtml(s)}</span>`).join("")}
                </div>
            </div>
        </div>
        ` : ""}

        ${course.prerequisites && course.prerequisites.length > 0 ? `
        <div style="margin-bottom: 20px;">
            <h4 style="color: #fbbf24; font-size: 0.85rem; margin-bottom: 8px;">📋 Prerequisites</h4>
            <div class="skill-tags">
                ${course.prerequisites.map(p => `<span class="concept-tag">${escapeHtml(p)}</span>`).join("")}
            </div>
        </div>
        ` : ""}

        <div class="weeks-container">
            ${(course.weeks || []).map((week, i) => renderWeekCard(week, i, targetRole)).join("")}
        </div>
    `;

    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeCourse() {
    document.getElementById("courseOverlay").style.display = "none";
    document.body.style.overflow = "";
}

// ───── Week Card ─────
function renderWeekCard(week, index, targetRole) {
    const focusClass = `focus-${(week.focus || "theory").toLowerCase()}`;
    const concepts = week.concepts || [];

    return `
    <div class="week-card" id="week-${index}">
        <div class="week-header" onclick="toggleWeek(${index}, '${escapeAttr(week.title || "")}', '${escapeAttr(JSON.stringify(concepts))}', '${escapeAttr(targetRole)}')">
            <div class="week-header-left">
                <div class="week-number">${week.week || index + 1}</div>
                <div class="week-title">${escapeHtml(week.title || `Week ${index + 1}`)}</div>
            </div>
            <div class="week-header-right">
                <span class="week-focus ${focusClass}">${escapeHtml(week.focus || "theory")}</span>
                <span class="expand-icon">▼</span>
            </div>
        </div>
        ${concepts.length > 0 ? `
        <div class="week-concepts">
            ${concepts.map(c => `<span class="concept-tag">${escapeHtml(c)}</span>`).join("")}
        </div>
        ` : ""}
        <div class="week-details" id="week-details-${index}"></div>
    </div>`;
}

// Toggle Week
async function toggleWeek(index, weekTitle, conceptsJson, targetRole) {
    const card = document.getElementById(`week-${index}`);
    const details = document.getElementById(`week-details-${index}`);

    if (card.classList.contains("expanded")) {
        card.classList.remove("expanded");
        return;
    }

    card.classList.add("expanded");

    // If already loaded, just show
    if (details.dataset.loaded === "true") return;

    details.innerHTML = `<div class="week-details-loading"><div class="spinner" style="width:24px;height:24px;margin:0 auto 8px;"></div>Loading daily breakdown...</div>`;

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
            .map((day, i) => renderDayCard(day, index, i, targetRole))
            .join("");

        details.dataset.loaded = "true";
    } catch (error) {
        details.innerHTML = `<div class="week-details-loading" style="color: #fb7185;">⚠️ ${error.message}</div>`;
    }
}

// ───── Day Card ─────
function renderDayCard(day, weekIndex, dayIndex, targetRole) {
    const typeClass = `focus-${(day.task_type || "theory").toLowerCase()}`;
    return `
    <div class="day-card" id="day-${weekIndex}-${dayIndex}">
        <div class="day-header" onclick="toggleDay(${weekIndex}, ${dayIndex}, '${escapeAttr(day.title || "")}', ${day.day || dayIndex + 1}, '${escapeAttr(day.task_type || "theory")}', ${day.duration_minutes || 60}, '${escapeAttr(targetRole)}')">
            <span class="day-title">Day ${day.day || dayIndex + 1}: ${escapeHtml(day.title || "")}</span>
            <div class="day-meta">
                <span class="day-type ${typeClass}">${escapeHtml(day.task_type || "theory")}</span>
                <span class="day-duration">${day.duration_minutes || 60} min</span>
            </div>
        </div>
        <div class="day-detail" id="day-detail-${weekIndex}-${dayIndex}"></div>
    </div>`;
}

// Toggle Day
async function toggleDay(weekIndex, dayIndex, dayTitle, dayNumber, taskType, duration, targetRole) {
    const card = document.getElementById(`day-${weekIndex}-${dayIndex}`);
    const detail = document.getElementById(`day-detail-${weekIndex}-${dayIndex}`);

    if (card.classList.contains("expanded")) {
        card.classList.remove("expanded");
        return;
    }

    card.classList.add("expanded");

    if (detail.dataset.loaded === "true") return;

    detail.innerHTML = `<div class="week-details-loading"><div class="spinner" style="width:20px;height:20px;margin:0 auto 6px;"></div>Loading content...</div>`;
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
        detail.innerHTML = `<div class="week-details-loading" style="color: #fb7185;">⚠️ ${error.message}</div>`;
    }
}

function renderDayDetail(data) {
    const toc = data.table_of_contents || [];
    const resources = data.resources || [];

    return `
        <p class="day-description">${escapeHtml(data.description || "")}</p>

        ${toc.length > 0 ? `
        <div class="day-toc">
            <h5>Topics Covered</h5>
            <ul>${toc.map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
        </div>
        ` : ""}

        ${resources.length > 0 ? `
        <div class="day-resources">
            <h5>📚 Resources</h5>
            ${resources.map(r => `
                <a href="${escapeAttr(r.url || "#")}" target="_blank" rel="noopener" class="resource-link">
                    ${r.thumbnail ? `<img src="${escapeAttr(r.thumbnail)}" class="resource-thumb" onerror="this.style.display='none'">` : ""}
                    <div class="resource-info">
                        <div class="resource-title">${escapeHtml(r.title || "Resource")}</div>
                        <div class="resource-source ${r.source || "web"}">${r.source === "youtube" ? "▶ YouTube" : "🌐 Web Article"}</div>
                    </div>
                </a>
            `).join("")}
        </div>
        ` : ""}
    `;
}

// ───── UI Helpers ─────
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

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/'/g, "&#39;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
