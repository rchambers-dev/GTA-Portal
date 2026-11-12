import { escapeHtml } from "../../lib/html.js";
import { closeTutorDatePickers, closeTutorOwnerPickers } from "./date-picker.js";

export function tutorHelpButton(topic, label) {
  return `<button type="button" class="tutor-help-btn" data-tutor-help="${escapeHtml(topic)}" aria-label="${escapeHtml(label)}">?</button>`;
}

export function tutorHelpPopupHtml() {
  return `
    <div class="tutor-help-popup" data-tutor-help-popup hidden>
      <button type="button" class="tutor-help-backdrop" data-tutor-help-dismiss aria-label="Close help"></button>
      <div class="tutor-help-card" role="dialog" aria-modal="true" aria-labelledby="tutor-help-title">
        <div class="tutor-help-card-head">
          <h3 id="tutor-help-title" data-tutor-help-title></h3>
          <button type="button" class="btn ghost" data-tutor-help-dismiss>Close</button>
        </div>
        <div class="tutor-help-body" data-tutor-help-body></div>
      </div>
    </div>
  `;
}

function tutorHelpExample(rows) {
  return `
    <div class="tutor-help-example">
      <p class="meta">Example</p>
      ${rows
        .map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</p>`)
        .join("")}
    </div>
  `;
}

function tutorHelpProgress(title, intro, exampleRows, extraItems = []) {
  return {
    title: `How to fill ${title}`,
    html: `
      <p>${escapeHtml(intro)}</p>
      <p>Write from what you have seen in teaching, the workbook, or your own notes. Do not write as if you have spoken to the employer, mentor, or anyone else unless you have already said that in your comments.</p>
      <ul>
        <li><strong>Red, amber or green</strong> — red if they are behind, amber if they need a push, green if they are on track.</li>
        <li><strong>Evidence</strong> — write a clear note that matches the colour. Use most of the word limit, about two thirds, not just a short line.</li>
        <li><strong>Action ref</strong> — optional. Link it to a target if one covers this, such as T1 workbook unit 1 and weekly log.</li>
        ${extraItems.map((item) => `<li>${item}</li>`).join("")}
      </ul>
      ${tutorHelpExample(exampleRows)}
    `,
  };
}

function tutorHelpContent(topic) {
  if (topic === "target") {
    return {
      title: "How to set a target",
      html: `
        <p>Write one clear thing that should happen before the next review. You do not need all three targets if one or two is enough. Use most of each box, about two thirds of the word limit. Write it as the tutor, from the work you have seen. Do not add a conversation with the employer or anyone else unless you have already said that in your comments.</p>
        <ul>
          <li><strong>Action / target</strong> — what needs to happen.</li>
          <li><strong>Owner</strong> — who will do it: apprentice, employer or tutor.</li>
          <li><strong>Target date</strong> — when it should be done. Use a day in the next 10 weeks. Green days on the calendar can be picked.</li>
          <li><strong>Success measure</strong> — how you will know it is done.</li>
        </ul>
        ${tutorHelpExample([
          [
            "Action / target",
            "Complete workbook unit 1 this cycle, keep a weekly off-the-job log, and bring signed work to the next review so progress can be checked against the standard.",
          ],
          ["Owner", "Apprentice"],
          ["Target date", "Thu 22/10/2026"],
          [
            "Success measure",
            "Unit 1 is signed off, the off-the-job log shows at least one recorded hour each week, and the apprentice can talk through the unit without prompts at the next review.",
          ],
        ])}
      `,
    };
  }
  if (topic === "summary") {
    return {
      title: "How to write the previous review summary",
      html: `
        <p>Sum up last time from the previous tutor notes: how they were doing, what was agreed, and what was left to do. Use most of the box, about two thirds of the word limit, not just one short sentence. Do not add a conversation that is not already in those notes.</p>
        ${tutorHelpExample([
          [
            "Tutor summary",
            "At the last review the apprentice was settling in well and making a steady start on the programme. Attendance at college release was consistent and workbook unit 1 was the agreed follow-up, along with keeping a weekly off-the-job log before this review. No concerns were recorded in the last tutor notes.",
          ],
        ])}
      `,
    };
  }
  if (topic === "comment") {
    return {
      title: "How to write the tutor comment",
      html: `
        <p>Write your view as the tutor from the work you have seen this cycle and what should happen next. Use most of the box, about two thirds of the word limit, so the printed form has a full comment. Do not write as if you have spoken to the employer, mentor, or anyone else unless you have already said that in your comments.</p>
        ${tutorHelpExample([
          [
            "GTA tutor contribution",
            "The apprentice is making a positive start on this programme. From the work I have seen this cycle they are getting through the basics and staying on top of the set tasks. Attendance at college release has been consistent this block and they arrive ready to learn. Workbook unit 1 is underway and they are keeping an off-the-job log, which should help them stay on track with hours. Knowledge is coming on, though written tasks still need prompts, so workbook unit 1 remains the main follow-up. They can explain the last workshop topic in their own words, but they lose confidence when the question is not practical. Practical skill is stronger than last time. They can complete a basic inspection with less support and the standard of finished workshop work has improved. Behaviours are good. They raise questions in session rather than leaving gaps, and they work well with others in the group. English and maths are not required on this standard. They are not close to gateway yet, so the focus stays on gathering signed-off evidence and building a habit of logging learning each week. I am happy with the progress I have seen in class and in the book. Before the next review the apprentice should finish unit 1, keep the weekly log complete, and bring signed work so progress can be checked against the standard. I will look at the log again at the next review. No extra concerns have been recorded for this apprentice this cycle.",
          ],
        ])}
      `,
    };
  }
  if (topic === "overall_progress") {
    return tutorHelpProgress(
      "Overall progress",
      "Use this for how the apprenticeship is going as a whole this cycle.",
      [
        ["Colour", "Green"],
        [
          "Evidence",
          "From the work I have seen this cycle the apprenticeship is on track. Attendance at college release has been consistent, the first workbook unit is underway, and a weekly off-the-job log is being kept. They are settling into the programme and getting through the routine tasks. No concerns have been recorded about attitude or timekeeping. The follow-up is to finish unit 1 and keep the weekly log complete before the next review so progress can be checked properly.",
        ],
        ["Action ref", "T1 workbook unit 1 and weekly off-the-job log"],
      ],
    );
  }
  if (topic === "knowledge_theory") {
    return tutorHelpProgress(
      "Knowledge / theory",
      "Use this for college, workbook and theory knowledge.",
      [
        ["Colour", "Amber"],
        [
          "Evidence",
          "Workbook unit 1 is underway and they can explain the last workshop topic in their own words. Written tasks still need prompts and they lose confidence when the question is not practical. College release is being used and they are getting time in session to complete the book. They need a regular slot and a check at the next review to show the unit is signed off. This is amber because knowledge is moving, but the written work is not yet at the standard I need to see.",
        ],
        ["Action ref", "T1 workbook unit 1 and weekly off-the-job log"],
      ],
    );
  }
  if (topic === "practical_skills") {
    return tutorHelpProgress(
      "Practical skills",
      "Use this for workshop and on-the-job skills.",
      [
        ["Colour", "Green"],
        [
          "Evidence",
          "Practical skill has improved since last time. They can complete a basic inspection with less support and the standard of finished workshop work has improved. They follow the process and ask before they guess. They still need a watch on the less familiar tasks, but the work is good enough for this stage. This is green because they are practising the right work in session and getting faster without dropping quality.",
        ],
        ["Action ref", "T2 basic inspection with less support"],
      ],
    );
  }
  if (topic === "behaviours_attendance") {
    return tutorHelpProgress(
      "Behaviours and attendance",
      "Use this for timekeeping, attitude and how they work with others.",
      [
        ["Colour", "Green"],
        [
          "Evidence",
          "They have been on time this block and raise questions in session rather than leaving gaps. Attitude in the group is good and they work well with others. They arrive ready to learn and take feedback without getting defensive. No behaviour or attendance concerns have been recorded this cycle. This is green because timekeeping and conduct are where I need them to be for this stage of the programme.",
        ],
        ["Action ref", ""],
      ],
    );
  }
  if (topic === "english_maths") {
    return tutorHelpProgress(
      "English and maths",
      "Use this for functional skills. If it is not part of this apprenticeship, say that in the evidence and use most of the box.",
      [
        ["Colour", "Green"],
        [
          "Evidence",
          "English and maths are not applicable to this apprentice at this review. Functional skills are not part of this apprenticeship standard, so no extra English or maths work is required this cycle. I am marking this not applicable unless the standard or funding rules change before the next review. No catch-up plan is needed and no action is set against this row.",
        ],
        ["Action ref", ""],
      ],
    );
  }
  if (topic === "off_the_job") {
    return {
      title: "How to fill off-the-job training",
      html: `
        <p>Enter the hours they should have, then the hours they are at now. The colour is set from those two numbers. Write a clear evidence note from the log and the work you have seen. Use most of the word limit. Do not add a conversation that is not already in your comments.</p>
        <ul>
          <li><strong>Target hours</strong> — what they should have by now.</li>
          <li><strong>Current hours</strong> — what they have logged.</li>
          <li><strong>Evidence</strong> — logging, release time or catch-up. Use about two thirds of the word limit.</li>
          <li><strong>Action ref</strong> — optional. Link it to a target if one covers the hours.</li>
        </ul>
        ${tutorHelpExample([
          ["Target hours", "445"],
          ["Current hours", "475"],
          ["Track", "On track · 107%"],
          [
            "Evidence",
            "Hours are logged each week and a weekly workbook slot is in place. Current hours sit a little ahead of the target, so they are on track this cycle. Release time is being used and they know to record learning on the day it happens. Keep the weekly log going and bring it to the next review so the total can be checked against what has been taught.",
          ],
        ])}
      `,
    };
  }
  if (topic === "epa_gateway") {
    return tutorHelpProgress(
      "EPA / gateway",
      "Use this for how close they are to gateway or EPA. If they are not close yet, say that and still use most of the box.",
      [
        ["Colour", "Amber"],
        [
          "Evidence",
          "They are not yet close to gateway or EPA. Portfolio evidence is still being gathered and there is no planned gateway date this cycle. The focus should stay on signed-off work tasks, workbook unit 1, and a complete off-the-job log. Keep collecting evidence each week and closeness can be checked again at the next review. This is amber because the work has started, but they are not ready to plan gateway yet.",
        ],
        ["Action ref", "T3 gather signed-off work for the portfolio"],
      ],
    );
  }
  return null;
}

export function closeTutorHelp() {
  document.querySelectorAll("[data-tutor-help-popup]").forEach((popup) => {
    popup.classList.remove("open");
    const hide = () => {
      if (!popup.classList.contains("open")) popup.hidden = true;
    };
    popup.addEventListener("transitionend", hide, { once: true });
    setTimeout(hide, 520);
  });
}

export function openTutorHelp(topic) {
  const popup = document.querySelector("[data-tutor-help-popup]");
  const info = tutorHelpContent(topic);
  if (!popup || !info) return;
  const title = popup.querySelector("[data-tutor-help-title]");
  const body = popup.querySelector("[data-tutor-help-body]");
  if (title) title.textContent = info.title;
  if (body) body.innerHTML = info.html;
  popup.hidden = false;
  popup.classList.remove("open");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => popup.classList.add("open"));
  });
  closeTutorDatePickers();
  closeTutorOwnerPickers();
}
