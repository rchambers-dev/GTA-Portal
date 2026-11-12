import { parseFormDate } from "./reviews.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
// eslint-disable-next-line no-unused-vars
const PHONE = /\b(0[\d\s-]{8,14}\d)\b/;
const DATE = /\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\b/;
const DATE_SPACED = /\b(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{2,4})\b/;
const JUNK =
  /^(all\s*three|mentor|gta|tripartite|apprentice|employer|reviewer|progress review|training association|give[s]? the|discuss|agree|confirm)$/i;
const PERSON = /^[A-Za-z][A-Za-z'`.\-]*$/;
const COMPANY_TAIL = /\b(ltd|limited|garage|council|college|services|group|holdings|llp|plc)\b/i;

const LABEL_DEFS = [
  { key: "name", tokens: ["apprentice", "name"] },
  { key: "", tokens: ["review", "date"], skipIf: /planned/ },
  { key: "apprenticeship", tokens: ["apprenticeship", "standard"] },
  { key: "collegeDay", tokens: ["release", "day"] },
  { key: "tutor", tokens: ["gta", "tutor"] },
  { key: "gtaReviewer", tokens: ["gta", "reviewer"] },
  { key: "apprenticeshipStartDate", tokens: ["apprenticeship", "start", "date"] },
  { key: "apprenticeshipEndDate", tokens: ["planned", "end", "date"] },
  { key: "apprenticeshipEndDate", tokens: ["apprenticeship", "end", "date"] },
  { key: "apprenticeshipEndDate", tokens: ["end", "date"], skipIf: /review/ },
  { key: "company", tokens: ["employer", "workplace"] },
  { key: "mentor", tokens: ["workplace", "mentor"] },
  { key: "employerContact", tokens: ["employer", "contact", "name"] },
  { key: "contactNumber", tokens: ["contact", "phone"] },
  { key: "employerEmail", tokens: ["contact", "email"] },
  { key: "", tokens: ["planned", "review", "date"] },
  { key: "postcode", tokens: ["postcode"] },
];

function tidy(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[:.\-|]+\s*/, "")
    .replace(/\s*[:.\-|]+$/, "")
    .trim();
}

function firstMatch(text, pattern) {
  return tidy(text.match(pattern)?.[1] || "");
}

function isJunk(value) {
  const text = tidy(value);
  if (!text) return true;
  if (JUNK.test(text)) return true;
  if (/tripartite|progress review|group training|all three/i.test(text) && text.length < 40) {
    return true;
  }
  return false;
}

function wordLooksNamed(word) {
  const letters = String(word || "").replace(/[^A-Za-z]/g, "");
  if (letters.length < 2 || /[0-9@/]/.test(word) || !PERSON.test(word)) return false;
  if (letters.length <= 3 && letters === letters.toUpperCase()) return false;
  const rest = letters.slice(1);
  const title = letters[0] === letters[0].toUpperCase() && rest === rest.toLowerCase();
  return title || /^Mc[A-Z]/.test(letters);
}

const NAME_STOP =
  /^(status|the|on|of|for|and|off|job|hours|section|progress|details|give|agree|confirm|target|action|measure|owner|this|that|with|from)$/i;

function looksLikePerson(value) {
  const words = tidy(value).split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (words.some((word) => !wordLooksNamed(word) || NAME_STOP.test(word))) return false;
  if (
    /vehicle|maintenance|standard|garage|limited|review|apprentice|employer|contact|\bjob\b|hours|status/i.test(
      value,
    )
  ) {
    return false;
  }
  return words.some((word) => word.replace(/[^A-Za-z]/g, "").length >= 4);
}

function looksLikeCompany(value) {
  const text = tidy(value);
  if (!text || isJunk(text) || text.length < 4) return false;
  return COMPANY_TAIL.test(text) || /garage|commercials|motors|engineering/i.test(text);
}

function emptyProfile() {
  return {
    name: "",
    company: "",
    postcode: "",
    collegeDay: "",
    tutor: "",
    apprenticeship: "",
    gtaReviewer: "",
    employerContact: "",
    contactNumber: "",
    employerEmail: "",
    apprenticeshipStartDate: "",
    apprenticeshipEndDate: "",
    mentor: "",
  };
}

function cleanValue(key, raw) {
  let value = tidy(raw).replace(
    /\b(review date|release day|gta tutor|gta reviewer|apprenticeship start date|apprenticeship planned end date|apprenticeship end date|employer \/ workplace|workplace mentor|employer contact name|employer contact phone number|employer contact email address|planned review date|postcode)\b.*$/i,
    "",
  );
  value = tidy(value);
  if (isJunk(value)) return "";
  if (key === "name") {
    value = value.replace(/\b(review\s*date|apprenticeship|release day)\b.*$/i, "").trim();
    return looksLikePerson(value) ? value : "";
  }
  if (key === "tutor" || key === "employerContact" || key === "mentor") {
    return looksLikePerson(value) ? value : "";
  }
  if (key === "gtaReviewer") {
    if (/all\s*three/i.test(value) || !looksLikePerson(value)) return "";
    return value;
  }
  if (key === "collegeDay") {
    return WEEKDAYS.find((day) => new RegExp(`\\b${day}\\b`, "i").test(value)) || "";
  }
  if (key === "apprenticeshipStartDate" || key === "apprenticeshipEndDate") {
    return parseLooseDate(value);
  }
  if (key === "postcode") return firstMatch(value, POSTCODE) || "";
  if (key === "employerEmail") return firstMatch(value, EMAIL) || "";
  if (key === "contactNumber") return harvestPhone(value);
  if (key === "company") return looksLikeCompany(value) || value.length > 6 ? value : "";
  if (key === "apprenticeship") {
    value = value.replace(/^(standard|route|level|\/)+\s*/i, "").trim();
    return value.length > 3 ? value : "";
  }
  return value;
}

function parseLooseDate(value) {
  const direct = parseFormDate(firstMatch(value, DATE) || "");
  if (direct) return direct;
  const spaced = DATE_SPACED.exec(String(value || "").replace(/[oO]/g, "0"));
  if (!spaced) return "";
  return parseFormDate(`${spaced[1]}/${spaced[2]}/${spaced[3]}`);
}

const MONTHS = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function harvestDates(text) {
  const found = [];
  const source = String(text || "")
    .replace(/[oO](?=\d)/g, "0")
    .replace(/([/\-.])[lI]([/\-.\d])/g, "$11$2");
  const add = (iso) => {
    if (iso && !found.includes(iso)) found.push(iso);
  };
  for (const match of source.matchAll(new RegExp(DATE_SPACED.source, "g"))) {
    add(parseFormDate(`${match[1]}/${match[2]}/${match[3]}`));
  }
  for (const match of source.matchAll(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{2,4})\b/gi,
  )) {
    add(parseFormDate(`${match[1]}/${MONTHS[match[2].toLowerCase()]}/${match[3]}`));
  }
  return found;
}

function harvestEmail(text) {
  const emails = [...String(text || "").matchAll(new RegExp(EMAIL.source, "gi"))].map((item) => item[0]);
  return emails.find((item) => !/gta\.(ac\.uk|org)/i.test(item)) || emails[0] || "";
}

function harvestCompany(text) {
  const match = String(text || "").match(
    /\b([A-Z][A-Za-z0-9&.'\-]+(?:\s+[A-Z][A-Za-z0-9&.'\-]+){0,6}\s+(?:Ltd|Limited|Garage|Council|College|Services|Group|Holdings|LLP|PLC))\b/,
  );
  return tidy(match?.[1] || "");
}

function harvestPhone(text) {
  const candidates = [];
  for (const match of String(text || "").matchAll(/0[\d\s-]{8,16}/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 10) candidates.push(digits.slice(0, 11));
  }
  return candidates.find((digits) => digits.length === 11) || candidates.find((digits) => digits.length === 10) || "";
}

function harvestApprenticeship(text) {
  const match = String(text || "").match(
    /\b((?:light|heavy)\s+vehicle(?:\s+(?:maintenance|repair|technician|standard))?|hvm\s+standard|engineering\s+technician|motor\s+vehicle(?:\s+[A-Za-z]+)?)\b/i,
  );
  return tidy(match?.[1] || "");
}

export function parsePhotoText(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  const profile = emptyProfile();
  const detailsAt = text.search(/1\.\s*review details|review details/i);
  const hits = [];
  const labels = [
    { key: "name", pattern: /apprentice\s*name/i },
    { key: "", pattern: /(?<!planned\s)review\s*date\b/i },
    { key: "apprenticeship", pattern: /apprenticeship\s*standard(?:\s*\/?\s*route\s*\/?\s*level)?/i },
    { key: "collegeDay", pattern: /release\s*day/i },
    { key: "tutor", pattern: /gta\s*tutor/i },
    { key: "gtaReviewer", pattern: /gta\s*reviewer/i },
    { key: "apprenticeshipStartDate", pattern: /apprenticeship\s*start\s*date/i },
    { key: "apprenticeshipEndDate", pattern: /apprenticeship\s*(?:planned\s*)?end\s*date/i },
    { key: "company", pattern: /employer\s*\/?\s*workplace/i },
    { key: "mentor", pattern: /workplace\s*mentor/i },
    { key: "employerContact", pattern: /employer\s*contact\s*name/i },
    { key: "contactNumber", pattern: /employer\s*contact\s*phone(?:\s*number)?/i },
    { key: "employerEmail", pattern: /employer\s*contact\s*email(?:\s*address)?/i },
    { key: "", pattern: /planned\s*review\s*date/i },
    { key: "postcode", pattern: /postcode/i },
  ];
  for (const label of labels) {
    const finder = new RegExp(label.pattern.source, `${label.pattern.flags.replace("g", "")}g`);
    let match = finder.exec(text);
    while (match) {
      hits.push({ key: label.key, start: match.index, end: match.index + match[0].length });
      match = finder.exec(text);
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const useful = detailsAt >= 0 ? hits.filter((hit) => hit.start >= detailsAt) : hits;
  const pool = useful.length ? useful : hits;
  const seen = new Set();
  for (let index = 0; index < pool.length; index += 1) {
    const hit = pool[index];
    if (!hit.key || seen.has(hit.key) || profile[hit.key]) continue;
    const next = pool[index + 1];
    const value = cleanValue(hit.key, text.slice(hit.end, next ? next.start : text.length));
    if (value) {
      profile[hit.key] = value;
      seen.add(hit.key);
    }
  }
  return finishProfile(profile, text);
}

function finishProfile(profile, text) {
  if (!profile.employerEmail) profile.employerEmail = harvestEmail(text);
  if (!profile.contactNumber) profile.contactNumber = harvestPhone(text);
  if (!profile.company) profile.company = harvestCompany(text);
  if (!profile.apprenticeship) profile.apprenticeship = harvestApprenticeship(text);
  if (!profile.name) {
    const beforeReview = /(?:^|\d\.\s*review details\s+)?([A-Z][A-Za-z'`.\-]+(?:\s+[A-Z][A-Za-z'`.\-]+){1,3})\s+Review\s*date/i.exec(
      text,
    );
    if (looksLikePerson(beforeReview?.[1])) profile.name = tidy(beforeReview[1]);
  }
  if (!profile.employerContact && looksLikePerson(profile.mentor)) {
    profile.employerContact = profile.mentor;
  }
  if (!profile.tutor) {
    const afterTutor = /gta\s*tutor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/.exec(text)?.[1] || "";
    if (looksLikePerson(afterTutor)) profile.tutor = tidy(afterTutor);
  }
  if (!profile.employerContact) {
    const afterMentor = /(?:workplace\s*)?mentor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i.exec(text)?.[1] || "";
    if (looksLikePerson(afterMentor)) profile.employerContact = tidy(afterMentor);
  }
  const dates = harvestDates(text).sort();
  if (!profile.apprenticeshipStartDate) profile.apprenticeshipStartDate = dates[0] || "";
  if (!profile.apprenticeshipEndDate) {
    profile.apprenticeshipEndDate =
      dates.find((key) => key !== profile.apprenticeshipStartDate) || "";
  }
  if (
    profile.apprenticeshipStartDate &&
    profile.apprenticeshipEndDate &&
    profile.apprenticeshipStartDate > profile.apprenticeshipEndDate
  ) {
    const swap = profile.apprenticeshipStartDate;
    profile.apprenticeshipStartDate = profile.apprenticeshipEndDate;
    profile.apprenticeshipEndDate = swap;
  }
  if (!profile.collegeDay) {
    const afterRelease = /release\s*day\s+([A-Za-z]{3,})/i.exec(text)?.[1] || "";
    profile.collegeDay =
      WEEKDAYS.find((day) => day.toLowerCase() === afterRelease.toLowerCase()) || "";
  }
  const out = emptyProfile();
  for (const key of Object.keys(out)) {
    if (key === "mentor") continue;
    out[key] = profile[key] || "";
  }
  return out;
}

function closeEnough(word, token) {
  const a = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  const b = String(token || "").toLowerCase();
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return a.length >= 3 || b.length <= 3;
  if (Math.abs(a.length - b.length) > 2) return false;
  let miss = 0;
  const long = a.length >= b.length ? a : b;
  const short = a.length >= b.length ? b : a;
  let index = 0;
  for (const letter of long) {
    if (short[index] === letter) index += 1;
    else miss += 1;
    if (miss > 1) return false;
  }
  return index >= short.length - 1;
}

function wordsFromPage(data) {
  const blocks = data?.blocks || [];
  const words = [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        for (const word of line.words || []) {
          const text = tidy(word.text);
          if (!text || Number(word.confidence) < 30) continue;
          const box = word.bbox || {};
          words.push({
            text,
            x0: box.x0,
            y0: box.y0,
            x1: box.x1,
            y1: box.y1,
            x: (box.x0 + box.x1) / 2,
            y: (box.y0 + box.y1) / 2,
          });
        }
      }
    }
  }
  return words.sort((a, b) => a.y - b.y || a.x0 - b.x0);
}

function matchLabelAt(words, start, def) {
  const first = words[start];
  if (!first || !closeEnough(first.text, def.tokens[0])) return null;
  const used = [first];
  let tokenIndex = 1;
  for (let index = start + 1; index < words.length && tokenIndex < def.tokens.length; index += 1) {
    const word = words[index];
    if (Math.abs(word.y - first.y) > 22) break;
    if (word.x0 < first.x0 - 8) break;
    if (closeEnough(word.text, def.tokens[tokenIndex])) {
      used.push(word);
      tokenIndex += 1;
    }
  }
  if (tokenIndex < def.tokens.length) return null;
  if (def.skipIf && def.skipIf.test(used.map((word) => word.text).join(" "))) return null;
  return {
    key: def.key,
    x0: Math.min(...used.map((word) => word.x0)),
    x1: Math.max(...used.map((word) => word.x1)),
    y0: Math.min(...used.map((word) => word.y0)),
    y1: Math.max(...used.map((word) => word.y1)),
    y: used.reduce((sum, word) => sum + word.y, 0) / used.length,
  };
}

function parsePhotoWords(data, rawText) {
  const words = wordsFromPage(data);
  const profile = emptyProfile();
  if (!words.length) return finishProfile(profile, rawText);
  const labels = [];
  for (let index = 0; index < words.length; index += 1) {
    for (const def of LABEL_DEFS) {
      const hit = matchLabelAt(words, index, def);
      if (hit) labels.push(hit);
    }
  }
  const width = Math.max(...words.map((word) => word.x1), 1);
  const midX =
    labels.find((hit) => /reviewer|release|review date|planned|phone|mentor|end date/i.test(hit.key || ""))
      ?.x0 || width * 0.52;
  for (const label of labels) {
    if (!label.key || profile[label.key]) continue;
    const sameRow = labels
      .filter((other) => other !== label && Math.abs(other.y - label.y) < 20)
      .sort((a, b) => a.x0 - b.x0);
    const nextRight = sameRow.find((other) => other.x0 > label.x1);
    const left = label.x1 + 6;
    const right = nextRight ? nextRight.x0 - 4 : label.x0 < midX ? midX - 4 : width + 20;
    const top = label.y0 - 12;
    const bottom = label.y1 + 28;
    const value = words
      .filter((word) => word.x0 >= left && word.x1 <= right + 8 && word.y >= top && word.y <= bottom)
      .sort((a, b) => a.x0 - b.x0)
      .map((word) => word.text)
      .join(" ");
    const cleaned = cleanValue(label.key, value);
    if (cleaned) profile[label.key] = cleaned;
  }
  const startLabel = labels.find((hit) => hit.key === "apprenticeshipStartDate");
  if (startLabel && !profile.apprenticeshipEndDate) {
    const rowText = words
      .filter((word) => Math.abs(word.y - startLabel.y) < 24)
      .sort((a, b) => a.x0 - b.x0)
      .map((word) => word.text)
      .join(" ");
    const extra = harvestDates(rowText).find((key) => key !== profile.apprenticeshipStartDate);
    if (extra) profile.apprenticeshipEndDate = extra;
  }
  if (!profile.apprenticeshipEndDate || !profile.apprenticeshipStartDate) {
    const allDates = harvestDates(words.map((word) => word.text).join(" "));
    if (!profile.apprenticeshipStartDate) profile.apprenticeshipStartDate = allDates[0] || "";
    if (!profile.apprenticeshipEndDate) {
      profile.apprenticeshipEndDate =
        allDates.find((key) => key !== profile.apprenticeshipStartDate) || "";
    }
  }
  return finishProfile(profile, rawText);
}

function mergeProfiles(...profiles) {
  const out = emptyProfile();
  for (const key of Object.keys(out)) {
    if (key === "mentor") continue;
    const person = ["name", "tutor", "employerContact", "gtaReviewer"].includes(key);
    out[key] =
      profiles
        .map((profile) => profile?.[key] || "")
        .find((value) => value && !isJunk(value) && (!person || looksLikePerson(value))) || "";
  }
  return out;
}

function scoreProfile(profile, text) {
  let score = 0;
  if (looksLikePerson(profile.name)) score += 4;
  else if (profile.name) score -= 2;
  if (profile.company) score += 2;
  if (profile.postcode) score += 2;
  if (looksLikePerson(profile.tutor)) score += 2;
  if (looksLikePerson(profile.employerContact)) score += 2;
  if (profile.employerEmail) score += 3;
  if (profile.contactNumber) score += 2;
  if (profile.apprenticeshipStartDate) score += 2;
  if (profile.apprenticeshipEndDate) score += 2;
  if (profile.apprenticeship) score += 2;
  if (looksLikePerson(profile.gtaReviewer)) score += 1;
  if (/apprentice name|review details|release day/i.test(text)) score += 3;
  return score;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not open that photo."));
    };
    image.src = url;
  });
}

function preparePhoto(image, degrees = 0, mode = "contrast") {
  const longest = Math.max(image.width, image.height);
  const scale = longest < 1800 ? 2200 / longest : Math.min(1, 2600 / longest);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const swap = degrees % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? height : width;
  canvas.height = swap ? width : height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  let min = 255;
  let max = 0;
  for (let index = 0; index < data.length; index += 4) {
    const grey = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    data[index] = data[index + 1] = data[index + 2] = grey;
    if (grey < min) min = grey;
    if (grey > max) max = grey;
  }
  const range = Math.max(1, max - min);
  for (let index = 0; index < data.length; index += 4) {
    let value = ((data[index] - min) / range) * 255;
    value = (value - 128) * 1.55 + 140;
    if (mode === "binary") value = value > 155 ? 255 : 0;
    else if (value > 225) value = 255;
    else if (value < 45) value = 0;
    data[index] = data[index + 1] = data[index + 2] = Math.max(0, Math.min(255, value));
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function clampRect(canvas, rect) {
  const left = Math.max(0, Math.round(rect.left));
  const top = Math.max(0, Math.round(rect.top));
  const width = Math.max(8, Math.min(canvas.width - left, Math.round(rect.width)));
  const height = Math.max(8, Math.min(canvas.height - top, Math.round(rect.height)));
  if (left >= canvas.width || top >= canvas.height) return null;
  return { left, top, width, height };
}

function labelsFromWords(words) {
  const labels = [];
  for (let index = 0; index < words.length; index += 1) {
    for (const def of LABEL_DEFS) {
      const hit = matchLabelAt(words, index, def);
      if (hit) labels.push(hit);
    }
  }
  return labels;
}

function missingCellRects(canvas, data, profile) {
  const words = wordsFromPage(data);
  const labels = labelsFromWords(words);
  const width = canvas.width;
  const height = canvas.height;
  const rects = [];
  const startLabel = labels.find((hit) => hit.key === "apprenticeshipStartDate");
  const startDateWord = words.find((word) => harvestDates(word.text).includes(profile.apprenticeshipStartDate));
  if (!profile.apprenticeshipEndDate) {
    const y0 = startLabel?.y0 ?? startDateWord?.y0 ?? height * 0.28;
    const y1 = startLabel?.y1 ?? startDateWord?.y1 ?? height * 0.4;
    rects.push({
      key: "apprenticeshipEndDate",
      digits: true,
      rect: { left: width * 0.7, top: y0 - 24, width: width * 0.28, height: y1 - y0 + 64 },
    });
  }
  if (!profile.employerContact) {
    const mentor = labels.find((hit) => hit.key === "mentor");
    const contact = labels.find((hit) => hit.key === "employerContact");
    const label = contact || mentor;
    if (label) {
      rects.push({
        key: "employerContact",
        rect: {
          left: label.x1 + 8,
          top: label.y0 - 12,
          width: Math.min(width * 0.28, width * 0.5 - label.x1),
          height: label.y1 - label.y0 + 40,
        },
      });
    }
  }
  return rects;
}

async function recognizeCrop(worker, canvas, crop, PSM) {
  const rectangle = clampRect(canvas, crop.rect);
  if (!rectangle) return "";
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_char_whitelist: crop.digits ? "0123456789/-. " : "",
  });
  const result = await worker.recognize(canvas, { rectangle }, { text: true });
  return tidy(result.data?.text || "");
}

async function fillMissingCells(worker, canvas, profile, data, PSM) {
  const next = { ...profile };
  for (const crop of missingCellRects(canvas, data, next)) {
    if (next[crop.key]) continue;
    const text = await recognizeCrop(worker, canvas, crop, PSM);
    const value = cleanValue(crop.key, text) || (crop.digits ? harvestDates(text).find((key) => key !== next.apprenticeshipStartDate) : "");
    if (value) next[crop.key] = value;
  }
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_char_whitelist:
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@._-+/'&:() ",
  });
  return next;
}

async function readPhoto(worker, canvas, PSM) {
  const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const text = result.data?.text || "";
  const fromWords = parsePhotoWords(result.data, text);
  const fromText = parsePhotoText(text);
  let profile = mergeProfiles(fromWords, fromText);
  if (!profile.apprenticeshipEndDate || !profile.employerContact) {
    profile = await fillMissingCells(worker, canvas, profile, result.data, PSM);
  }
  return { profile, text, score: scoreProfile(profile, text) };
}

export async function extractSection1FromPhoto(file, onProgress) {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text" && onProgress) {
        onProgress(Math.round((message.progress || 0) * 100));
      }
    },
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    const image = await loadImage(file);
    let degrees = 0;
    try {
      const detected = await worker.detect(preparePhoto(image, 0, "contrast"));
      const turn = Number(detected?.data?.orientation_degrees || 0);
      if (turn === 90 || turn === 180 || turn === 270) degrees = (360 - turn) % 360;
    } catch {
      // Try the four ways up if orientation cannot be read.
    }
    let best = await readPhoto(worker, preparePhoto(image, degrees, "contrast"), PSM);
    if (!best.profile.apprenticeshipEndDate || best.score < 12) {
      const binary = await readPhoto(worker, preparePhoto(image, degrees, "binary"), PSM);
      if (binary.score > best.score || (binary.profile.apprenticeshipEndDate && !best.profile.apprenticeshipEndDate)) {
        best = binary;
      }
    }
    if (best.score < 10) {
      for (const extra of [0, 90, 180, 270]) {
        if (extra === degrees) continue;
        const next = await readPhoto(worker, preparePhoto(image, extra, "contrast"), PSM);
        if (next.score > best.score) best = next;
        if (best.profile.name && best.profile.employerEmail && best.profile.apprenticeshipStartDate) {
          break;
        }
      }
    }
    return best.profile;
  } finally {
    await worker.terminate();
  }
}
