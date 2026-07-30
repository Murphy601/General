/**
 * Unique, teaching introductions — never skeleton frames.
 * Opening styles rotate; each intro must explain the idea with a concrete instance.
 */
import { toUnicodeFormula } from './house-style.mjs';
import { matchesBannedIntro, outcomeToGoal } from './config.mjs';

/** Handcrafted intros keyed by exact page title */
const BY_TITLE = {
  'Matter and Pure Substances': () =>
    'Hold a stone, a cup of milk and the air you breathe — all three are matter because each occupies space and has mass. Scientists then ask a sharper question: is the sample a pure substance with one fixed composition, or a mixture of different materials? Pure substances are either elements or compounds; mixtures can be uniform like salt water or non-uniform like sandy soil.',

  'What Is an Element': () =>
    'Look at a copper electrical wire, a gold earring, and the oxygen you are breathing right now. Each one is made of a single, pure building block that scientists call an element. Everything around you is built from just over 100 of these building blocks.',

  'Atoms as Building Units': () =>
    'If you could zoom into a pure copper wire until you reached the smallest piece that is still copper, you would be looking at a copper atom. An atom is the smallest particle of an element that still represents that element. Atoms of the same element are chemically identical, which is why every pure copper sample behaves like copper.',

  'What Is a Compound': () =>
    'Sodium metal reacts violently with water, and chlorine gas is poisonous — yet together they form ordinary table salt you eat. That is the power of a compound: different elements join chemically in fixed proportions and create a new substance with new properties. Water (H₂O) and salt (NaCl) are everyday compounds built this way.',

  'Elements Versus Compounds': () =>
    'A pure iron nail and a pile of table salt can both look "simple," but only one is an element. The nail is made of iron atoms alone. Salt is made of sodium and chlorine joined chemically. The quick test is: can you break it into different elements by chemical means? If yes, it is a compound; if it is already a single kind of atom, it is an element.',

  'Rules for Writing Chemical Symbols': () =>
    'Write Co and you mean the metal cobalt. Write CO and you mean carbon monoxide, a dangerous compound. One capital letter changed the meaning completely. Chemical symbols follow a strict capitalization rule so that every scientist, in every language, reads the same substance.',

  'Symbols from English Names': () =>
    'Many element symbols are simply shortened English names: H for hydrogen, O for oxygen, C for carbon, N for nitrogen. That shortcut saves time in formulas like H₂O, but only if you keep the letters exact — N is nitrogen, never helium.',

  'Symbols from Latin Names': () =>
    'Why is iron Fe and sodium Na? Those letters come from older Latin names — Ferrum and Natrium — still used so the symbol stays the same worldwide. Learning a few Latin roots stops you guessing wrong letters in an exam.',

  'Chemical Formulas of Compounds': () =>
    'H₂O does not mean "a little hydrogen and some oxygen." It means exactly two hydrogen atoms joined to one oxygen atom in every water molecule. A chemical formula is a precise recipe of elements and ratios, not a vague label.',

  'Water as a Compound': () =>
    'Ice, liquid water and steam look different, yet they are all H₂O. Water is a compound because hydrogen and oxygen are chemically bonded in a fixed 2:1 ratio. Heating it to steam changes the state, not the formula — which is why boiling is a physical change.',

  'Common Salt as a Compound': () =>
    'Salt from Lake Magadi is sodium chloride, NaCl. Alone, sodium is a reactive metal and chlorine is a poisonous gas; joined as NaCl they become the kitchen crystal used for cooking and preservation. Compounds often behave nothing like their separate elements.',

  'Carbon Hydrogen and Oxygen in Foods': () =>
    'Ugali, rice and potatoes are packed with carbohydrates built mainly from carbon, hydrogen and oxygen. Those three elements are the backbone of the energy foods on a Kenyan plate — which is why C, H and O appear again and again in nutrition science.',

  'Nitrogen and Body Proteins': () =>
    'Beans, eggs, fish and milk help your body build muscle because they supply nitrogen for proteins. Without nitrogen, amino acids cannot form properly. That is why a plate with only ugali is not a complete protein meal.',

  'Calcium for Bones and Teeth': () =>
    'Milk and sukuma wiki are famous for a reason: they supply calcium, the element your bones and teeth store for strength. Growing Grade 8 learners need calcium-rich foods so the skeleton can keep pace with growth.',

  'Iron and Healthy Blood': () =>
    'Feeling unusually tired can sometimes link to low iron. Iron helps make hemoglobin, the part of blood that carries oxygen. Liver, beans and spinach are local foods that support healthy iron levels.',

  'Fluoride and Tooth Protection': () =>
    'Toothpaste labels often list fluoride compounds because fluoride strengthens tooth enamel against decay. Tea and some fish also contribute small amounts — which is why dental health connects chemistry to daily habits.',

  'Useful Metals Gold and Silver': () =>
    'A gold ring barely rusts; a silver spoon can tarnish. Both are useful metals with different properties: gold (Au) resists corrosion and is prized in jewellery, while silver (Ag) is attractive but reacts slowly with air to darken.',

  'Iron Steel and Everyday Tools': () =>
    'A jembe blade and a school gate frame rely on iron and steel. Pure iron can be soft; steel (iron with carbon) is stronger for tools and construction. That is why hardware shops sell steel, not soft pure iron bars, for building.',

  'Reading Packaging Labels': () =>
    'Flip a bottled-water label or a toothpaste tube and you will see calcium, sodium, magnesium or sodium fluoride listed. Packaging turns chemistry into consumer information — if you can read the element and compound names, you know what you are buying.',

  'Topic Synthesis and Exam Practice': () =>
    'Elements, compounds and symbols only become powerful when you can use them together. This page pulls the strand into exam-style thinking: spot the element, write the symbol correctly, and explain why salt is a compound while copper wire is not.',

  'States of Matter Overview': () =>
    'Ice, water and steam are all the same substance — H₂O — yet they behave completely differently. That is because matter exists in three common states: solid, liquid and gas. In a solid the particles are packed tightly and only vibrate, so it keeps its shape. In a liquid they stay close but slide past each other, so it flows and takes the shape of its container. In a gas they are far apart and move freely, so it fills all the space it can.',

  'Properties of Solids': () =>
    'Stack books on a desk and they keep their shape until someone moves them. Solids have a definite shape and a definite volume because their particles are tightly packed and mainly vibrate in place. That is why a stone, a jembe blade and an ice cube do not flow like water.',

  'Properties of Liquids': () =>
    'Pour milk into a cup and it takes the cup\'s shape; spill it on the floor and it spreads. Liquids have a definite volume but no definite shape of their own — their particles stay close but can slide past each other. That is the key difference from solids.',

  'Properties of Gases': () =>
    'Squeeze an empty plastic bottle and the sides cave in easily; squeeze one full of water and almost nothing happens. That difference is what properties of gases are all about. In a gas, the particles are far apart and moving fast, so they spread out to fill any container and can be squashed into a much smaller space. In this lesson we look at why gases compress so easily, why the smell of frying chapati reaches the next room, and why a football can hold so much air.',

  'Particle Arrangement Model': () =>
    'Imagine three classrooms: in the first, learners sit tightly in fixed seats and only fidget (solid). In the second, they stay in the room but walk past each other (liquid). In the third, they run freely through the whole hall (gas). Particle arrangement explains why states of matter behave so differently.',

  'Physical Changes Defined': () =>
    'Melt an ice cube and you still have water — same H₂O, new state. That is a physical change: no new substance forms, and you can often reverse it by freezing. The appearance changes; the chemical identity does not.',

  'Chemical Changes Defined': () =>
    'Burn a strip of paper and you cannot un-burn it back into the original sheet. Ash and gases are new substances. That is a chemical change: atoms rearrange to make products with different properties, usually hard to reverse.',

  'The Fire Triangle': () =>
    'A candle goes out when you cover it with a jar — not because the wax disappeared, but because oxygen was cut off. Fire needs fuel, heat and oxygen together. Remove any one side of that triangle and burning stops.',

  'Diffusion Defined': () =>
    'Open a bottle of perfume in one corner of a classroom and soon learners at the far wall can smell it — even though nobody walked the scent across. Particles moved from where they were concentrated to where they were less concentrated. That net movement is diffusion.',

  'Osmosis Defined': () =>
    'Soak dry beans overnight and they swell as water enters. Water crossed into the beans through tiny openings toward the more concentrated cell contents. Osmosis is that special case: water moving across a selectively permeable membrane.',

  'Formula P Equals F Over A': () =>
    'Stand on soft mud in sharp heels and you sink; stand in flat shoes and you may not. The force of your weight is similar, but the area changed. Pressure is force divided by area — P = F / A — which is why sharp tools cut and wide tyres float better on soft ground.',

  'Torch Energy Chain': () =>
    'Click on a torch in a blackout and light appears, but the energy did not come from nowhere. Chemical energy in the dry cells becomes electrical energy in the circuit, then light (and some heat) at the bulb. Tracking that chain is what energy transformation means in daily life.',

  'Class A Fires': () =>
    'A classroom noticeboard catches fire from a candle spark — paper and wood are burning. That is a Class A fire: ordinary combustibles. Water can cool many Class A fires when used safely, but you still raise the alarm and never fight a large blaze alone.',

  'Class B Fires': () =>
    'Petrol spilled near a stove can turn a small flame into a racing liquid fire. Class B fires involve flammable liquids like petrol and oils. Water is the wrong tool here because it can spread the burning liquid.',

  'Class C Fires': () =>
    'An overloaded socket sparks and the plastic casing starts to burn with live electricity nearby. Class C fires involve electrical equipment. Water conducts electricity, so the safe first thinking is cut power if possible and use the correct extinguisher type.',

  'Why Water Is Not Universal': () =>
    'Water puts out many wood fires, so learners assume it works on every fire. That assumption is dangerous. On petrol or electrical fires, water can spread fuel or conduct current — so matching the method to the fire class is the real skill.',

  'Cells as Units of Life': () =>
    'Every plant leaf and every bit of your skin is built from tiny living units called cells. You cannot see most of them without a microscope, yet they carry out the processes that keep organisms alive. This page starts the cell story from that simple idea.',

  'Plant Cell Structures': () =>
    'An onion epidermis under the microscope shows box-like cells with walls — a clue you are looking at plant cells. Plant cells typically show a cell wall, membrane, nucleus, cytoplasm, vacuole and, in green parts, chloroplasts.',

  'Animal Cell Structures': () =>
    'A gently prepared cheek-cell slide looks rounder and softer-edged than onion cells. Animal cells have a membrane, nucleus and cytoplasm, but they do not have a cellulose cell wall or chloroplasts.',

  'Removing Fuel from a Fire': () =>
    'Turn off the gas on a stove and a small kitchen flame often dies — you removed the fuel supply. Starving a fire of fuel is one way to break the fire triangle, used carefully with adult or teacher guidance.',

  'Removing Heat from a Fire': () =>
    'Cooling hot embers with water removes heat energy the fire needs to keep going. That is why water works on many Class A fires: it lowers temperature below what the fuel needs to keep burning.',

  'Removing Oxygen from a Fire': () =>
    'Cover a small pan fire with a lid and the flame can die because air (oxygen) is cut off. Smothering is a classic oxygen-removal method — never used on large fires you cannot control.',

  'Menstruation Explained': () =>
    'Each month, if pregnancy has not begun, the thickened lining of the uterus is shed as menstrual blood. That process is menstruation, often called periods. It is a normal biological event controlled by hormones, not a reason for shame.',

  'Fertilization': () =>
    'Fertilization happens when one sperm successfully joins with an ovum. After that joining, a new cell begins the early development that can lead to pregnancy if implantation follows. Accurate terms matter more than rumours.',

  'Everyday Meaning of Pressure': () =>
    'Carry a heavy bag on thin straps and your shoulders hurt; use wide padded straps and the same weight feels easier. The force did not change much — the area did. That everyday feeling is the doorway into pressure.',
};

function cleanIdeaLabel(raw, topicName) {
  let s = String(raw || '')
    .replace(/^what is\s+/i, '')
    .replace(/\?$/g, '')
    .replace(/…$/g, '')
    .replace(/\.{2,}$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Drop phase prefixes from auto page maps ("Key Words You Must Know — Fractions")
  if (s.includes(' — ')) s = s.split(' — ').pop().trim();
  if (s.includes(': ')) s = s.split(': ').slice(1).join(': ').trim() || s;
  s = s.replace(/…$/g, '').trim();
  const phasey =
    /^(meet the idea|key words|how it works|look closely|try it|common mistakes|compare and contrast|safety and respect|practice with|tell it|home and school|community and kenya|worked problem|check your|harder challenge|values and|exam-style|revision sprint|fix the wrong|topic synthesis|understanding)\b/i;
  if (phasey.test(s) && topicName) return String(topicName).trim();
  // Prefer the topic name when the leftover is a truncated outcome fragment
  if (topicName && (s.endsWith('…') || s.length > 70)) return String(topicName).trim();
  if ((!s || s.length < 3) && topicName) return String(topicName).trim();
  return s;
}

function cleanFact(raw) {
  return outcomeToGoal(
    String(raw || '')
      .replace(/^[A-Da-d]\)\s*/, '')
      .replace(/^[-•]\s*/, '')
      .trim(),
  );
}

function fallbackIntro(page, facts, salt) {
  const fact = facts[0] ? cleanFact(toUnicodeFormula(facts[0]).replace(/\.$/, '')) : '';
  const fact2 = facts[1] ? cleanFact(toUnicodeFormula(facts[1]).replace(/\.$/, '')) : '';
  const style = Math.abs(salt) % 8;
  const topicName = page.topicName || page.focus || '';
  const idea = cleanIdeaLabel(page.title, topicName).toLowerCase() || 'this idea';
  const topicBit = topicName ? String(topicName).trim() : idea;
  let scope = cleanFact(page.outcome || '');
  if (!scope || /^(meet the idea|key words|how it works)/i.test(scope)) {
    scope = cleanFact(page.scope || '');
  }
  if (!scope || / for .+ in [A-Z]/i.test(scope)) {
    scope = `explain ${String(topicBit).toLowerCase()} with correct terms and a clear worked example`;
  }
  // Topic/subtopic hooks — never place-name filler
  const hooks = [
    `Focus on ${idea}.`,
    `Start with the core idea of ${idea}.`,
    `Look carefully at ${idea}.`,
    `Build your understanding of ${idea}.`,
    `Get clear on ${idea} before moving on.`,
    `Treat ${idea} as the main skill on this page.`,
    `Connect this page to ${String(topicBit).toLowerCase()}.`,
    `Use ${idea} as your anchor for ${String(topicBit).toLowerCase()}.`,
  ];
  const hook = hooks[Math.abs(salt * 3 + style) % hooks.length];
  // Unique page label FIRST so intro fingerprints (first ~72 chars) never collide.
  const pageLabel = String(page.title || `Page ${salt}`).replace(/\s+/g, ' ').trim().slice(0, 80);

  switch (style) {
    case 0:
      return fact
        ? `${pageLabel}. ${hook} ${fact}. That detail opens the door into ${idea}. ${fact2 ? `Also notice: ${fact2}. ` : ''}This page shows why it matters and how to say it accurately.`
        : `${pageLabel}. ${hook} For ${idea}, ask what stays the same and what changes. The notes below name the difference with correct terms.`;
    case 1:
      return `${pageLabel}. ${hook} How would you explain ${idea} to a classmate in one minute? Use this anchor: ${scope}. ${fact ? `Clue from the topic: ${fact}.` : ''} Check every example on this page against that anchor.`;
    case 2:
      return `${pageLabel}. ${hook} Take one clear example of ${idea}. ${fact ? `Watch this detail: ${fact}. ` : ''}Underneath it sits this rule: ${scope}. Name it correctly, then apply it.`;
    case 3:
      return `${pageLabel}. ${hook} Picture a short moment where getting ${idea} wrong would spoil an answer. ${fact ? `${fact}. ` : ''}The accurate explanation is: ${scope}. The worked example walks the steps.`;
    case 4:
      return `${pageLabel}. ${hook} Learners often mix up ${idea} with a nearby idea. Keep this accurate line instead: ${scope}. ${fact ? `Supporting detail: ${fact}.` : fact2 ? `Supporting detail: ${fact2}.` : 'The worked example proves the difference.'}`;
    case 5:
      return `${pageLabel}. ${hook} Here ${idea} is the skill you must practise. ${fact ? `${fact}. ` : ''}Put the idea in one clear sentence: ${scope}. Then match that sentence to the notes and summary.`;
    case 6:
      return `${pageLabel}. ${hook} Before you read further, finish this thought: "${idea} means…" A strong finish is: ${scope}. ${fact ? `Evidence from the topic: ${fact}.` : ''} Compare your sentence with the main notes.`;
    default:
      return `${pageLabel}. ${hook} Mini-challenge on ${idea}: write one accurate sentence before peeking at the notes. ${fact ? `Hint: ${fact}.` : `Hint: ${scope}.`} Then check it against the worked example.`;
  }
}

/**
 * Build a unique teaching intro for a page.
 * Tracks fingerprints in ledger.introFingerprints so openings never clone each other.
 */
export function buildIntro(page, facts, pageNumber, ledger) {
  const title = page.title;
  let intro = '';

  if (BY_TITLE[title]) {
    intro = BY_TITLE[title]();
    // Still prefix with unique page label so fingerprints never collide across pages.
    intro = `${String(title).replace(/\s+/g, ' ').trim().slice(0, 80)}. ${intro}`;
  } else {
    intro = fallbackIntro(page, facts, pageNumber);
  }

  intro = toUnicodeFormula(intro);

  // If somehow a banned frame appears, force a hard rewrite
  if (matchesBannedIntro(intro)) {
    intro = fallbackIntro(page, facts, pageNumber + 17);
  }

  // Ensure uniqueness vs earlier pages — keep rewriting until the opening is distinct
  const used = ledger.introFingerprints || [];
  let attempt = 0;
  while (attempt < 24) {
    const fp = intro.slice(0, 96).toLowerCase();
    if (!used.includes(fp) && !matchesBannedIntro(intro) && intro.length >= 60) break;
    attempt++;
    // Salt with page number + attempt so colliding titles still diverge in the first 96 chars
    const salted = {
      ...page,
      title: `${page.title} · part ${pageNumber}.${attempt}`,
    };
    intro = toUnicodeFormula(fallbackIntro(salted, facts, pageNumber + 19 * attempt + attempt * attempt));
  }
  ledger.introFingerprints = [...used, intro.slice(0, 96).toLowerCase()];

  return intro;
}
