"use client";

import styles from "./tutor-form.module.css";

type Example = { label: string; value: string };
type Topic = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  example: Example[];
};

const SHARED_BULLETS = [
  "Red, amber or green — red if they are behind, amber if they need a push, green if they are on track.",
  "Evidence — write a clear note that matches the colour. Use most of the word limit, about two thirds, not just a short line.",
  "Action ref — optional. Link it to a target if one covers this, such as T1 workbook unit 1 and weekly log.",
];

function progress(title: string, intro: string, example: Example[], extra: string[] = []): Topic {
  return {
    title: `How to fill ${title}`,
    paragraphs: [
      intro,
      "Write from what you have seen in teaching, the workbook, or your own notes. Do not write as if you have spoken to the employer, mentor, or anyone else unless you have already said that in your comments.",
    ],
    bullets: [...SHARED_BULLETS, ...extra],
    example,
  };
}

export const TUTOR_HELP: Record<string, Topic> = {
  summary: {
    title: "How to write the previous review summary",
    paragraphs: [
      "Sum up last time from the previous tutor notes: how they were doing, what was agreed, and what was left to do. Use most of the box, about two thirds of the word limit, not just one short sentence. Do not add a conversation that is not already in those notes.",
    ],
    example: [
      {
        label: "Tutor summary",
        value:
          "At the last review the apprentice was settling in well and making a steady start on the programme. Attendance at college release was consistent and workbook unit 1 was the agreed follow-up, along with keeping a weekly off-the-job log before this review. No concerns were recorded in the last tutor notes.",
      },
    ],
  },
  target: {
    title: "How to set a target",
    paragraphs: [
      "Write one clear thing that should happen before the next review. You do not need all three targets if one or two is enough. Use most of each box, about two thirds of the word limit. Write it as the tutor, from the work you have seen. Do not add a conversation with the employer or anyone else unless you have already said that in your comments.",
    ],
    bullets: [
      "Action / target — what needs to happen.",
      "Owner — who will do it: apprentice, employer or tutor.",
      "Target date — when it should be done. Use a day in the next 10 weeks. Green days on the calendar can be picked.",
      "Success measure — how you will know it is done.",
    ],
    example: [
      {
        label: "Action / target",
        value:
          "Complete workbook unit 1 this cycle, keep a weekly off-the-job log, and bring signed work to the next review so progress can be checked against the standard.",
      },
      { label: "Owner", value: "Apprentice" },
      { label: "Target date", value: "Thu 22/10/2026" },
      {
        label: "Success measure",
        value:
          "Unit 1 is signed off, the off-the-job log shows at least one recorded hour each week, and the apprentice can talk through the unit without prompts at the next review.",
      },
    ],
  },
  comment: {
    title: "How to write the tutor comment",
    paragraphs: [
      "Write your view as the tutor from the work you have seen this cycle and what should happen next. Use most of the box, about two thirds of the word limit, so the printed form has a full comment. Do not write as if you have spoken to the employer, mentor, or anyone else unless you have already said that in your comments.",
    ],
    example: [
      {
        label: "GTA tutor contribution",
        value:
          "The apprentice is making a positive start on this programme. From the work I have seen this cycle they are getting through the basics and staying on top of the set tasks. Attendance at college release has been consistent this block and they arrive ready to learn. Workbook unit 1 is underway and they are keeping an off-the-job log, which should help them stay on track with hours. Knowledge is coming on, though written tasks still need prompts, so workbook unit 1 remains the main follow-up. They can explain the last workshop topic in their own words, but they lose confidence when the question is not practical. Practical skill is stronger than last time. They can complete a basic inspection with less support and the standard of finished workshop work has improved. Behaviours are good. They raise questions in session rather than leaving gaps, and they work well with others in the group. English and maths are not required on this standard. They are not close to gateway yet, so the focus stays on gathering signed-off evidence and building a habit of logging learning each week. I am happy with the progress I have seen in class and in the book. Before the next review the apprentice should finish unit 1, keep the weekly log complete, and bring signed work so progress can be checked against the standard. I will look at the log again at the next review. No extra concerns have been recorded for this apprentice this cycle.",
      },
    ],
  },
  overall_progress: progress(
    "Overall progress",
    "Use this for how the apprenticeship is going as a whole this cycle.",
    [
      { label: "Colour", value: "Green" },
      {
        label: "Evidence",
        value:
          "From the work I have seen this cycle the apprenticeship is on track. Attendance at college release has been consistent, the first workbook unit is underway, and a weekly off-the-job log is being kept. They are settling into the programme and getting through the routine tasks. No concerns have been recorded about attitude or timekeeping. The follow-up is to finish unit 1 and keep the weekly log complete before the next review so progress can be checked properly.",
      },
      { label: "Action ref", value: "T1 workbook unit 1 and weekly off-the-job log" },
    ],
  ),
  knowledge_theory: progress(
    "Knowledge / theory",
    "Use this for college, workbook and theory knowledge.",
    [
      { label: "Colour", value: "Amber" },
      {
        label: "Evidence",
        value:
          "Workbook unit 1 is underway and they can explain the last workshop topic in their own words. Written tasks still need prompts and they lose confidence when the question is not practical. College release is being used and they are getting time in session to complete the book. They need a regular slot and a check at the next review to show the unit is signed off. This is amber because knowledge is moving, but the written work is not yet at the standard I need to see.",
      },
      { label: "Action ref", value: "T1 workbook unit 1 and weekly off-the-job log" },
    ],
  ),
  practical_skills: progress(
    "Practical skills",
    "Use this for workshop and on-the-job skills.",
    [
      { label: "Colour", value: "Green" },
      {
        label: "Evidence",
        value:
          "Practical skill has improved since last time. They can complete a basic inspection with less support and the standard of finished workshop work has improved. They follow the process and ask before they guess. They still need a watch on the less familiar tasks, but the work is good enough for this stage. This is green because they are practising the right work in session and getting faster without dropping quality.",
      },
      { label: "Action ref", value: "T2 basic inspection with less support" },
    ],
  ),
  behaviours_attendance: progress(
    "Behaviours and attendance",
    "Use this for timekeeping, attitude and how they work with others.",
    [
      { label: "Colour", value: "Green" },
      {
        label: "Evidence",
        value:
          "They have been on time this block and raise questions in session rather than leaving gaps. Attitude in the group is good and they work well with others. They arrive ready to learn and take feedback without getting defensive. No behaviour or attendance concerns have been recorded this cycle. This is green because timekeeping and conduct are where I need them to be for this stage of the programme.",
      },
      { label: "Action ref", value: "" },
    ],
  ),
  english_maths: progress(
    "English and maths",
    "Use this for functional skills. If it is not part of this apprenticeship, say that in the evidence and use most of the box.",
    [
      { label: "Colour", value: "Green" },
      {
        label: "Evidence",
        value:
          "English and maths are not applicable to this apprentice at this review. Functional skills are not part of this apprenticeship standard, so no extra English or maths work is required this cycle. I am marking this not applicable unless the standard or funding rules change before the next review. No catch-up plan is needed and no action is set against this row.",
      },
      { label: "Action ref", value: "" },
    ],
  ),
  off_the_job: {
    title: "How to fill off-the-job training",
    paragraphs: [
      "Enter the hours they should have, then the hours they are at now. The colour is set from those two numbers. Write a clear evidence note from the log and the work you have seen. Use most of the word limit. Do not add a conversation that is not already in your comments.",
    ],
    bullets: [
      "Target hours — what they should have by now.",
      "Current hours — what they have logged.",
      "Evidence — logging, release time or catch-up. Use about two thirds of the word limit.",
      "Action ref — optional. Link it to a target if one covers the hours.",
    ],
    example: [
      { label: "Target hours", value: "445" },
      { label: "Current hours", value: "475" },
      { label: "Track", value: "On track · 107%" },
      {
        label: "Evidence",
        value:
          "Hours are logged each week and a weekly workbook slot is in place. Current hours sit a little ahead of the target, so they are on track this cycle. Release time is being used and they know to record learning on the day it happens. Keep the weekly log going and bring it to the next review so the total can be checked against what has been taught.",
      },
    ],
  },
  epa_gateway: progress(
    "EPA / gateway",
    "Use this for how close they are to gateway or EPA. If they are not close yet, say that and still use most of the box.",
    [
      { label: "Colour", value: "Amber" },
      {
        label: "Evidence",
        value:
          "They are not yet close to gateway or EPA. Portfolio evidence is still being gathered and there is no planned gateway date this cycle. The focus should stay on signed-off work tasks, workbook unit 1, and a complete off-the-job log. Keep collecting evidence each week and closeness can be checked again at the next review. This is amber because the work has started, but they are not ready to plan gateway yet.",
      },
      { label: "Action ref", value: "T3 gather signed-off work for the portfolio" },
    ],
  ),
};

export function TutorHelpDialog({ topic, onClose }: { topic: string; onClose: () => void }) {
  const info = TUTOR_HELP[topic];
  if (!info) return null;
  return (
    <div className={styles.popup}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="tutor-help-title">
        <h2 id="tutor-help-title">{info.title}</h2>
        {info.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {info.bullets?.length ? (
          <ul className={styles.list}>
            {info.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className={styles.example}>
          <p>Example</p>
          {info.example.filter((row) => row.value).map((row) => (
            <p key={row.label}>
              <strong>{row.label}</strong>
              <br />
              {row.value}
            </p>
          ))}
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
