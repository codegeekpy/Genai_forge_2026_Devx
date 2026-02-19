/**
 * Resume Builder — Vanilla JS Logic
 * Form management, live preview rendering, AI calls, and file download.
 */

const API = 'http://localhost:8000';

// ═══ STATE ═══

const state = {
    personal: {
        fullName: '', jobTitle: '', email: '', phone: '',
        linkedin: '', website: '', summary: ''
    },
    experience: [],
    education: [],
    skills: [],
    config: {
        layout: 'modern',
        color: '#0e6b5e',
        font: 'sans'
    }
};


// ═══ INIT ═══

document.addEventListener('DOMContentLoaded', () => {
    // Auth guard
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'auth.html';
        return;
    }

    bindAccordions();
    bindTemplateBar();
    bindPersonalFields();
    bindExperienceSection();
    bindEducationSection();
    bindSkillsSection();
    bindActionButtons();
    bindLogout();
    renderPreview();

    // Pre-fill from URL param ?resume_id=X
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get('resume_id');
    if (resumeId) {
        prefillFromResume(resumeId, userId);
    }
});


// ═══ ACCORDION ═══

function bindAccordions() {
    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            const body = document.getElementById(`section-${section}`);
            const isOpen = body.classList.contains('open');
            btn.classList.toggle('active', !isOpen);
            body.classList.toggle('open', !isOpen);
        });
    });
}


// ═══ TEMPLATE BAR ═══

function bindTemplateBar() {
    // Layouts
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.config.layout = btn.dataset.layout;
            renderPreview();
        });
    });

    // Colors
    document.querySelectorAll('.swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            state.config.color = swatch.dataset.color;
            renderPreview();
        });
    });

    // Font
    document.getElementById('fontSelect').addEventListener('change', (e) => {
        state.config.font = e.target.value;
        renderPreview();
    });
}


// ═══ PERSONAL FIELDS ═══

function bindPersonalFields() {
    const fields = ['fullName', 'jobTitle', 'email', 'phone', 'linkedin', 'website', 'summary'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                state.personal[id] = el.value;
                renderPreview();
            });
        }
    });
}


// ═══ EXPERIENCE ═══

function bindExperienceSection() {
    document.getElementById('btnAddExperience').addEventListener('click', () => {
        state.experience.push({ title: '', company: '', date: '', description: '' });
        renderExperienceList();
        // Open accordion if closed
        const body = document.getElementById('section-experience');
        if (!body.classList.contains('open')) {
            body.classList.add('open');
            body.previousElementSibling.classList.add('active');
        }
    });
}

function renderExperienceList() {
    const container = document.getElementById('experienceList');
    container.innerHTML = '';

    state.experience.forEach((exp, i) => {
        const card = document.createElement('div');
        card.className = 'entry-card';
        card.innerHTML = `
            <button class="btn-remove-entry" data-index="${i}" title="Remove">✕</button>
            <div class="form-grid">
                <div class="field">
                    <label>Job Title</label>
                    <input type="text" data-field="title" data-index="${i}" value="${esc(exp.title)}" placeholder="Software Engineer">
                </div>
                <div class="field">
                    <label>Company</label>
                    <input type="text" data-field="company" data-index="${i}" value="${esc(exp.company)}" placeholder="Acme Inc.">
                </div>
                <div class="field">
                    <label>Date</label>
                    <input type="text" data-field="date" data-index="${i}" value="${esc(exp.date)}" placeholder="Jan 2023 — Present">
                </div>
                <div class="field">
                    <div class="field-header">
                        <label>Description</label>
                        <button class="ai-btn btn-polish-exp" data-index="${i}">✨ Polish</button>
                    </div>
                    <textarea data-field="description" data-index="${i}" rows="3" placeholder="Key achievements and responsibilities...">${esc(exp.description)}</textarea>
                </div>
            </div>`;
        container.appendChild(card);
    });

    // Bind inputs
    container.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', () => {
            const idx = parseInt(el.dataset.index);
            state.experience[idx][el.dataset.field] = el.value;
            renderPreview();
        });
    });

    // Remove buttons
    container.querySelectorAll('.btn-remove-entry').forEach(btn => {
        btn.addEventListener('click', () => {
            state.experience.splice(parseInt(btn.dataset.index), 1);
            renderExperienceList();
            renderPreview();
        });
    });

    // AI Polish buttons
    container.querySelectorAll('.btn-polish-exp').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.index);
            const textarea = container.querySelector(`textarea[data-index="${idx}"]`);
            if (!textarea.value.trim()) return;
            btn.disabled = true;
            btn.textContent = '⏳ Polishing...';
            const polished = await optimizeText(textarea.value);
            textarea.value = polished;
            state.experience[idx].description = polished;
            renderPreview();
            btn.disabled = false;
            btn.textContent = '✨ Polish';
        });
    });

    renderPreview();
}


// ═══ EDUCATION ═══

function bindEducationSection() {
    document.getElementById('btnAddEducation').addEventListener('click', () => {
        state.education.push({ degree: '', school: '', date: '' });
        renderEducationList();
        const body = document.getElementById('section-education');
        if (!body.classList.contains('open')) {
            body.classList.add('open');
            body.previousElementSibling.classList.add('active');
        }
    });
}

function renderEducationList() {
    const container = document.getElementById('educationList');
    container.innerHTML = '';

    state.education.forEach((edu, i) => {
        const card = document.createElement('div');
        card.className = 'entry-card';
        card.innerHTML = `
            <button class="btn-remove-entry" data-index="${i}" title="Remove">✕</button>
            <div class="form-grid">
                <div class="field">
                    <label>Degree / Certificate</label>
                    <input type="text" data-field="degree" data-index="${i}" value="${esc(edu.degree)}" placeholder="B.S. Computer Science">
                </div>
                <div class="field">
                    <label>School / Institution</label>
                    <input type="text" data-field="school" data-index="${i}" value="${esc(edu.school)}" placeholder="MIT">
                </div>
                <div class="field">
                    <label>Year / Date</label>
                    <input type="text" data-field="date" data-index="${i}" value="${esc(edu.date)}" placeholder="2020 — 2024">
                </div>
            </div>`;
        container.appendChild(card);
    });

    container.querySelectorAll('input').forEach(el => {
        el.addEventListener('input', () => {
            const idx = parseInt(el.dataset.index);
            state.education[idx][el.dataset.field] = el.value;
            renderPreview();
        });
    });

    container.querySelectorAll('.btn-remove-entry').forEach(btn => {
        btn.addEventListener('click', () => {
            state.education.splice(parseInt(btn.dataset.index), 1);
            renderEducationList();
            renderPreview();
        });
    });

    renderPreview();
}


// ═══ SKILLS ═══

function bindSkillsSection() {
    const input = document.getElementById('skillInput');
    const addBtn = document.getElementById('btnAddSkill');

    const addSkill = () => {
        const val = input.value.trim();
        if (val && !state.skills.includes(val)) {
            state.skills.push(val);
            input.value = '';
            renderSkillTags();
            renderPreview();
        }
    };

    addBtn.addEventListener('click', addSkill);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addSkill(); }
    });
}

function renderSkillTags() {
    const container = document.getElementById('skillsList');
    container.innerHTML = '';
    state.skills.forEach((skill, i) => {
        const tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.innerHTML = `${esc(skill)} <span class="remove-skill" data-index="${i}">✕</span>`;
        container.appendChild(tag);
    });

    container.querySelectorAll('.remove-skill').forEach(btn => {
        btn.addEventListener('click', () => {
            state.skills.splice(parseInt(btn.dataset.index), 1);
            renderSkillTags();
            renderPreview();
        });
    });
}


// ═══ ACTION BUTTONS ═══

function bindActionButtons() {
    // Magic Write
    document.getElementById('btnMagicWrite').addEventListener('click', async () => {
        const btn = document.getElementById('btnMagicWrite');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>Writing...';
        const summary = await generateSummary();
        document.getElementById('summary').value = summary;
        state.personal.summary = summary;
        renderPreview();
        btn.disabled = false;
        btn.innerHTML = '🪄 Magic Write';
    });

    // Polish Summary
    document.getElementById('btnPolishSummary').addEventListener('click', async () => {
        const textarea = document.getElementById('summary');
        if (!textarea.value.trim()) return;
        const btn = document.getElementById('btnPolishSummary');
        btn.disabled = true;
        btn.textContent = '⏳...';
        const polished = await optimizeText(textarea.value);
        textarea.value = polished;
        state.personal.summary = polished;
        renderPreview();
        btn.disabled = false;
        btn.textContent = '✨ Polish';
    });

    // Download PDF
    document.getElementById('btnDownloadPdf').addEventListener('click', async () => {
        const btn = document.getElementById('btnDownloadPdf');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>Generating...';
        try {
            const payload = buildPayload();
            const resp = await fetch(`${API}/api/resume-builder/generate-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error('PDF generation failed');
            const blob = await resp.blob();
            downloadBlob(blob, 'resume.pdf');
        } catch (err) {
            alert('PDF generation failed: ' + err.message);
        }
        btn.disabled = false;
        btn.innerHTML = '📥 PDF';
    });

    // Download DOCX
    document.getElementById('btnDownloadDocx').addEventListener('click', async () => {
        const btn = document.getElementById('btnDownloadDocx');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-inline"></span>Generating...';
        try {
            const payload = buildPayload();
            const resp = await fetch(`${API}/api/resume-builder/generate-docx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error('DOCX generation failed');
            const blob = await resp.blob();
            downloadBlob(blob, 'resume.docx');
        } catch (err) {
            alert('DOCX generation failed: ' + err.message);
        }
        btn.disabled = false;
        btn.innerHTML = '📄 DOCX';
    });
}


// ═══ API CALLS ═══

async function optimizeText(text) {
    try {
        const resp = await fetch(`${API}/api/resume-builder/ai-optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await resp.json();
        return data.optimized_text || text;
    } catch {
        return text;
    }
}

async function generateSummary() {
    try {
        const payload = buildPayload();
        const resp = await fetch(`${API}/api/resume-builder/ai-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        return data.summary || '';
    } catch {
        return '';
    }
}

async function prefillFromResume(resumeId, userId) {
    try {
        const resp = await fetch(`${API}/api/resume-builder/prefill/${resumeId}`);
        if (!resp.ok) return;
        const result = await resp.json();
        const d = result.data;
        if (!d) return;

        // Populate state
        if (d.personal) {
            Object.keys(d.personal).forEach(k => {
                state.personal[k] = d.personal[k] || '';
                const el = document.getElementById(k);
                if (el) el.value = d.personal[k] || '';
            });
        }
        if (d.experience && d.experience.length) {
            state.experience = d.experience;
            renderExperienceList();
            // open accordion
            document.getElementById('section-experience').classList.add('open');
            document.querySelector('[data-section="experience"]').classList.add('active');
        }
        if (d.education && d.education.length) {
            state.education = d.education;
            renderEducationList();
            document.getElementById('section-education').classList.add('open');
            document.querySelector('[data-section="education"]').classList.add('active');
        }
        if (d.skills && d.skills.length) {
            state.skills = d.skills;
            renderSkillTags();
            document.getElementById('section-skills').classList.add('open');
            document.querySelector('[data-section="skills"]').classList.add('active');
        }

        renderPreview();
    } catch (err) {
        console.warn('Pre-fill failed:', err);
    }
}


// ═══ UTILITY ═══

function buildPayload() {
    return {
        personal: { ...state.personal },
        experience: state.experience,
        education: state.education,
        skills: state.skills,
        template: state.config.layout,
        color: state.config.color,
        font: state.config.font
    };
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bindLogout() {
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'auth.html';
        });
    }
}


// ═══════════════════════════════════════════
//  LIVE PREVIEW RENDERER
// ═══════════════════════════════════════════

function renderPreview() {
    const preview = document.getElementById('resumePreview');
    const { layout, color, font } = state.config;
    const p = state.personal;

    // Font family for preview
    const fontMap = {
        sans: "'Helvetica', 'Arial', sans-serif",
        serif: "'Georgia', 'Times New Roman', serif",
        mono: "'Courier New', 'Consolas', monospace"
    };
    preview.style.fontFamily = fontMap[font] || fontMap.sans;

    // Check if empty
    const hasContent = p.fullName || p.jobTitle || p.summary
        || state.experience.length || state.education.length || state.skills.length;

    if (!hasContent) {
        preview.innerHTML = '<div class="rv-empty">Start typing to see your resume preview...</div>';
        return;
    }

    const contactParts = [p.email, p.phone, p.linkedin, p.website].filter(Boolean);
    let html = '';

    // ── HEADER ──
    html += renderHeader(layout, color, p, contactParts);

    // ── SUMMARY ──
    if (p.summary) {
        html += renderSectionTitle('SUMMARY', layout, color);
        html += `<p class="rv-summary">${esc(p.summary)}</p>`;
    }

    // ── EXPERIENCE ──
    if (state.experience.length) {
        html += renderSectionTitle('EXPERIENCE', layout, color);
        state.experience.forEach(exp => {
            if (!exp.title && !exp.company) return;
            html += `<div class="rv-entry">`;
            html += `<div class="rv-entry-header">
                        <span class="rv-entry-title">${esc(exp.title)}</span>
                        <span class="rv-entry-date">${esc(exp.date)}</span>
                      </div>`;
            if (exp.company) html += `<div class="rv-entry-subtitle">${esc(exp.company)}</div>`;
            if (exp.description) html += `<p class="rv-entry-desc">${esc(exp.description)}</p>`;
            html += `</div>`;
        });
    }

    // ── EDUCATION ──
    if (state.education.length) {
        html += renderSectionTitle('EDUCATION', layout, color);
        state.education.forEach(edu => {
            if (!edu.degree && !edu.school) return;
            html += `<div class="rv-entry">`;
            html += `<div class="rv-entry-header">
                        <span class="rv-entry-title">${esc(edu.degree)}</span>
                        <span class="rv-entry-date">${esc(edu.date)}</span>
                      </div>`;
            if (edu.school) html += `<div class="rv-entry-subtitle">${esc(edu.school)}</div>`;
            html += `</div>`;
        });
    }

    // ── SKILLS ──
    if (state.skills.length) {
        html += renderSectionTitle('SKILLS', layout, color);
        if (layout === 'creative' || layout === 'modern') {
            html += `<div class="rv-skills">`;
            state.skills.forEach(s => {
                html += `<span class="rv-skill-tag" style="background:${color}18;color:${color};border:1px solid ${color}30">${esc(s)}</span> `;
            });
            html += `</div>`;
        } else {
            html += `<p class="rv-skills">${state.skills.map(esc).join(', ')}</p>`;
        }
    }

    preview.innerHTML = html;
}


function renderHeader(layout, color, p, contactParts) {
    let h = '';
    const contactStr = contactParts.join(' | ');

    switch (layout) {
        case 'modern':
            h += `<h1 class="rv-name" style="color:${color}">${esc(p.fullName)}</h1>`;
            h += `<p class="rv-title" style="font-style:italic">${esc(p.jobTitle)}</p>`;
            h += `<p class="rv-contact">${esc(contactStr)}</p>`;
            h += `<hr class="rv-divider" style="background:${color}">`;
            break;

        case 'classic':
            h += `<h1 class="rv-name" style="text-align:center;letter-spacing:2px;color:#111">${esc((p.fullName || '').toUpperCase())}</h1>`;
            h += `<p class="rv-title" style="text-align:center">${esc(p.jobTitle)}</p>`;
            h += `<p class="rv-contact" style="text-align:center">${esc(contactStr)}</p>`;
            h += `<hr class="rv-divider" style="background:#333;margin:8px 60px 14px">`;
            break;

        case 'minimalist':
            h += `<h1 class="rv-name" style="font-size:26px;color:#111">${esc(p.fullName)}</h1>`;
            h += `<p class="rv-title" style="color:${color};text-transform:uppercase;letter-spacing:1px;font-size:11px">${esc(p.jobTitle)}</p>`;
            h += `<p class="rv-contact">${esc(contactStr)}</p>`;
            h += `<div style="height:16px"></div>`;
            break;

        case 'executive':
            h += `<h1 class="rv-name" style="color:${color};font-size:20px">${esc(p.fullName)}</h1>`;
            h += `<p class="rv-title" style="font-style:italic">${esc(p.jobTitle)}</p>`;
            h += `<p class="rv-contact" style="font-size:9px">${esc(contactStr)}</p>`;
            h += `<hr class="rv-divider" style="background:${color};height:2px">`;
            break;

        case 'creative':
            const parts = (p.fullName || '').split(' ');
            h += `<h1 class="rv-name" style="color:${color};font-size:26px;margin-bottom:0">${esc(parts[0] || '')}</h1>`;
            if (parts.length > 1) {
                h += `<h1 class="rv-name" style="color:#222;font-size:26px;margin-top:0">${esc(parts.slice(1).join(' '))}</h1>`;
            }
            h += `<div style="background:#222;color:#fff;display:inline-block;padding:4px 14px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:4px 0 8px">${esc(p.jobTitle)}</div>`;
            h += `<p class="rv-contact">${esc(contactStr)}</p>`;
            h += `<div style="height:10px"></div>`;
            break;
    }

    return h;
}


function renderSectionTitle(title, layout, color) {
    switch (layout) {
        case 'classic':
            return `<div class="rv-section-title" style="color:#111;border-bottom:1px solid ${color};padding-bottom:2px">${title}</div>`;
        case 'creative':
            return `<div class="rv-section-title" style="color:${color}"><span style="display:inline-block;width:20px;height:2px;background:${color};vertical-align:middle;margin-right:8px"></span>${title}</div>`;
        case 'minimalist':
            return `<div class="rv-section-title" style="color:#333;font-weight:400;letter-spacing:2px;font-size:11px">${title}</div>`;
        case 'executive':
            return `<div class="rv-section-title" style="color:${color};font-size:11px;letter-spacing:1.5px">${title}</div>`;
        default: // modern
            return `<div class="rv-section-title" style="color:${color}">${title}</div>`;
    }
}
