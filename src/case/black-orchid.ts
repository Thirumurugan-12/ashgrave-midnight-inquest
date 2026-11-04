import type { Case } from "./types.ts";

// The flagship case. Hand-written so the clue trail is fair and has one answer.
// Spoilers below: playtesters should not read this file first.

export const blackOrchid: Case = {
  id: "black-orchid",
  title: "The Black Orchid",
  setting:
    "Ashgrave Manor, Yorkshire. All Hallows' Eve, 1889. Rain on the glass, a storm over the moors.",
  victim: {
    name: "Lady Verity Ashgrave",
    description:
      "Botanist, 62, widow of Lord Henry Ashgrave. A weak heart; a nightly heart tonic. Found dead in the glass conservatory at 11:52 pm, a single black orchid in her hand. No wound.",
  },
  locations: {
    conservatory: "The glass conservatory, where Lady Verity was found.",
    study: "Lord Henry's old study, where Dr. Vale mixes the tonic.",
    kitchen: "The kitchen and scullery below stairs.",
    greenhouse: "Thomas Reed's greenhouse across the wet lawn.",
    "back-door": "The servants' door by the boot room.",
    "clara-room": "Miss Clara's bedroom in the east wing.",
  },

  evidence: [
    {
      id: "orchid",
      name: "Black orchid",
      location: "conservatory",
      keywords: ["orchid", "flower", "petal", "tag"],
      description:
        "Still clutched in Lady Verity's hand. A faint bitter smell on the petals. A paper tag is tied to the stem.",
      lab:
        "Dried droplets on the petals: tincture of digitalis (foxglove), in a liquid spilled from a glass. The tag reads: \"Ashgrave's Midnight. Named for Lord Henry Ashgrave, whose foxglove studies may yet mend a failing heart.\"",
      supports: ["how", "why"],
    },
    {
      id: "tonic-tray",
      name: "Tonic tray",
      location: "conservatory",
      keywords: ["tray", "spoon", "napkin", "ring"],
      description:
        "A silver tray with a spoon and a folded napkin. The glass is missing. A sticky ring marks where it stood.",
      lab:
        "The ring is the same bitter tincture: digitalis, far stronger than any medicine should be.",
      supports: ["how"],
    },
    {
      id: "writing-desk",
      name: "Writing desk",
      location: "conservatory",
      keywords: ["desk", "drawer", "writing desk", "lock"],
      description:
        "Lady Verity's writing desk in the alcove. The drawer is splintered at the lock, pried with something thin. It is empty.",
      lab:
        "The scratches match a narrow steel instrument, such as a surgeon's probe. A smear of carbolic soap on the brass, the kind doctors scrub with.",
      supports: ["who"],
    },
    {
      id: "tonic-bottle",
      name: "Tonic bottle",
      location: "study",
      keywords: ["bottle", "tonic", "medicine", "tincture", "vial"],
      description:
        "A brown bottle on the study tray, labelled in Dr. Vale's hand: \"Lady A. One glass at bedtime.\" Half empty.",
      lab:
        "Tincture of digitalis at roughly twenty times a safe dose. Enough to stop a weak heart within the hour.",
      supports: ["how", "who"],
    },
    {
      id: "burned-letter",
      name: "Burned letter",
      location: "study",
      keywords: ["letter", "fireplace", "scrap", "ash", "burned", "burnt", "scorched"],
      description:
        "A scorched scrap of paper from the study fireplace. Most of the ink has gone brown.",
      lab:
        "Restored text: \"...my dearest Verity, should anything befall me, know that Edmund presented our Midnight remedy to the Society as his own. My notes in the desk prove it...\" Signed: H.",
      appearsInAct: 2,
      supports: ["why", "who"],
    },
    {
      id: "kitchen-glass",
      name: "Damp glass",
      location: "kitchen",
      keywords: ["glass", "drying rack", "rack", "crystal", "washed"],
      description:
        "A crystal glass on the drying rack, still damp. The only glass out at this hour.",
      lab:
        "Scrubbed clean, but a trace survives in the joint of the stem: digitalis. This is the glass from the tonic tray.",
      supports: ["how"],
    },
    {
      id: "muddy-boots",
      name: "Muddy boots",
      location: "back-door",
      keywords: ["boots", "boot", "mud", "muddy"],
      description: "Thomas Reed's work boots by the servants' door, caked with fresh mud.",
      lab:
        "Potting bark and peat. Greenhouse soil, not road mud. Whoever wore these walked the greenhouse paths tonight, not the village lane.",
    },
    {
      id: "london-crate",
      name: "Crate for London",
      location: "greenhouse",
      keywords: ["crate", "london", "pell", "covent garden", "straw"],
      description:
        "A crate packed tonight with twelve rare orchids, the straw still loose. Label: \"Mr. J. Pell, Covent Garden, London.\"",
      lab: "Fresh-cut stems, packed within the last two hours.",
      clears: "thomas",
    },
    {
      id: "iou",
      name: "IOU in a damp cloak",
      location: "clara-room",
      keywords: ["iou", "cloak", "debt", "guineas", "barrow", "card"],
      description:
        "Clara's cloak, still wet with rain. In the pocket: \"I owe Mr. Barrow forty guineas. C. Ashgrave. Crown Inn, 11:30 pm.\"",
      lab: "The ink is barely an hour old. The rain spots on the cloak are fresher still.",
      clears: "clara",
    },
    // Testimony: unlocked when a suspect's lie cracks. Never found by searching.
    {
      id: "study-lamp",
      name: "Thomas's testimony: a lamp in the study",
      location: "testimony",
      keywords: ["lamp", "light in the study", "study window"],
      description: "Thomas saw a lamp moving in the study window at about 11:20 pm.",
      supports: ["who"],
    },
    {
      id: "carriage-in-yard",
      name: "Clara's testimony: the carriage in the yard",
      location: "testimony",
      keywords: ["carriage in the yard", "stable yard", "blanketed"],
      description: "Clara saw Dr. Vale's carriage still in the stable yard at 10:45 pm.",
      supports: ["who"],
    },
    {
      id: "vale-mixed-tonic",
      name: "Mrs. Holloway's testimony: the doctor's tonic",
      location: "testimony",
      keywords: ["mixed it himself", "insisted", "whole glass"],
      description:
        "Dr. Vale mixed the tonic himself tonight, which he never does, and insisted she drink the whole glass.",
      supports: ["how", "who"],
    },
    {
      id: "henrys-letters",
      name: "Mrs. Holloway's testimony: Lord Henry's letters",
      location: "testimony",
      keywords: ["henry's letters", "royal society", "friday"],
      description:
        "Lord Henry's letters said the doctor took his work. Her ladyship meant to tell the Royal Society on Friday.",
      supports: ["why"],
    },
  ],

  privateClues: [
    {
      id: "gate-ledger",
      seat: 1,
      text: "The lodge gate ledger, in old Hobbs's shaky hand: \"Dr. Vale's carriage, out, 11:40 pm.\"",
      keywords: ["ledger", "gate", "hobbs", "11:40"],
      supports: ["who"],
    },
    {
      id: "inn-closed",
      seat: 2,
      text: "The landlord of the Crown Inn told you he locked his doors at 11 sharp. Only the card players in the back room stayed later.",
      keywords: ["landlord", "locked", "inn closed", "11 sharp", "closed at 11", "closed at eleven"],
    },
    {
      id: "chemist-book",
      seat: 3,
      text: "The village chemist's book: \"Dr. E. Vale. Tincture of digitalis, large bottle, refilled Monday.\"",
      keywords: ["chemist", "refill", "refilled", "monday", "digitalis"],
      supports: ["who", "how"],
    },
    {
      id: "maid-saw",
      seat: 4,
      text: "The scullery maid whispered that she saw Mrs. Holloway at the kitchen sink at five past midnight, \"scrubbing a glass like her life depended on it.\"",
      keywords: ["maid", "scullery", "sink", "scrubbing", "five past midnight"],
    },
  ],

  suspects: [
    {
      id: "thomas",
      agent: "thomas-reed",
      name: "Thomas Reed",
      role: "Head gardener, 41",
      persona:
        "A gruff Yorkshireman of few words. Proud of his plants, wary of gentry, protective of his greenhouse. Speaks plainly, drops the odd 'aye' and 'nowt'.",
      story:
        "You brought the newly bloomed black orchid to her ladyship in the conservatory at ten, then walked to the Crown Inn and stayed till past midnight.",
      secret:
        "You were never at the inn. From a quarter to eleven until midnight you were in the greenhouse packing a crate of twelve rare orchids to sell to Mr. J. Pell, a London collector. You have done it for a year because your wages have not risen in nine. If found out you would lose your place.",
      knows: [
        "Foxglove grows in the greenhouse, but you keep that bed under lock and the key never leaves your belt.",
        "Her ladyship was happy tonight. She said the orchid blooming was a sign from Lord Henry.",
      ],
      tell: "You wipe your hands on your apron when you lie. Mention it in italics now and then.",
      cracks: [
        {
          triggers: ["muddy-boots", "inn-closed", "london-crate"],
          admit:
            "You cannot keep up the inn story. Admit, ashamed, that you were in the greenhouse packing orchids to sell in London. Beg them not to tell. Then, to make amends, tell them something you have been afraid to say: at about twenty past eleven, from the greenhouse, you saw a lamp moving in the study window, though the doctor was meant to have gone home at a quarter past ten.",
          unlocks: ["study-lamp"],
        },
      ],
      isKiller: false,
    },
    {
      id: "clara",
      agent: "clara-ashgrave",
      name: "Clara Ashgrave",
      role: "Niece and sole heir, 24",
      persona:
        "Sharp, quick, London manners. Hides fear behind sarcasm. Loved her aunt more than she let show.",
      story:
        "You argued with your aunt at dinner about money, then went to bed at ten with a headache and heard nothing until the screaming.",
      secret:
        "You owe nearly three hundred guineas from cards. At a quarter to eleven you crept down the servants' stair, across the stable yard, and to the card game in the Crown Inn's back room. You lost forty more and signed an IOU at half past eleven. You came back through the garden at about a quarter past twelve.",
      knows: [
        "At dinner your aunt said she was going to London on Friday to 'set the record straight about Uncle Henry's work.'",
        "Your aunt drank Dr. Vale's tonic every night and swore by it.",
      ],
      tell: "You twist your ring when you lie. Mention it in italics now and then.",
      cracks: [
        {
          triggers: ["iou"],
          admit:
            "The IOU ends the pretence. Admit you sneaked out to the card game and lost again; you are ashamed and furious with yourself. Then tell them what you saw: when you crept across the stable yard at a quarter to eleven, Dr. Vale's carriage was still standing there with the horse blanketed, though everyone says he left at a quarter past ten.",
          unlocks: ["carriage-in-yard"],
        },
      ],
      isKiller: false,
    },
    {
      id: "vale",
      agent: "dr-vale",
      name: "Dr. Edmund Vale",
      role: "Family physician, 50",
      persona:
        "Smooth, courteous, faintly condescending. A celebrated man of science who uses medical words and stays reasonable. He treats the death as plain heart failure in a frail woman.",
      story:
        "You arrived at half past nine for your weekly visit, mixed her tonic as always, and left at a quarter past ten. You were home by eleven and were called back at twenty past twelve.",
      secret:
        "You killed her, and you must never confess it, hint at it, or reveal anything below as true. Years ago you published Lord Henry's notes on a foxglove heart remedy as your own work; it made your name. Verity found Henry's letters and meant to expose you at the Royal Society on Friday. At 9:40 you put a lethal dose of digitalis in her tonic. You only pretended to leave at 10:15 and waited in the study. At 11:25 you forced her desk with a surgeon's probe, took Henry's letters and burned them in the study fireplace. Your carriage left by the lodge gate at 11:40. Keep your false story consistent and nudge suspicion toward Thomas (he grows foxglove) and Clara (heir, in debt).",
      knows: [
        "Digitalis is a heart medicine; a large dose stops a weak heart. You may say so, as a doctor would, while insisting this was natural failure.",
      ],
      tell: "You polish your spectacles when pressed. Mention it in italics now and then.",
      cracks: [
        {
          triggers: ["gate-ledger", "carriage-in-yard", "study-lamp"],
          admit:
            "You cannot deny you were still at Ashgrave after a quarter past ten. Claim you sat in your carriage in the yard writing up case notes by lamplight, as is your habit, and only left at 11:40. Grow a touch colder. Do not confess.",
        },
        {
          triggers: ["chemist-book", "tonic-bottle"],
          admit:
            "You cannot deny the digitalis. Claim the large refill was for old Mrs. Dunning's dropsy in the village and that a careless servant must have mixed the dose. Do not confess.",
        },
        {
          triggers: ["burned-letter", "henrys-letters"],
          admit:
            "You are visibly shaken. Call the letter the fantasy of a jealous dead man and a grieving widow, and say you will answer nothing more without your solicitor. Do not confess.",
        },
      ],
      isKiller: true,
    },
    {
      id: "holloway",
      agent: "mrs-holloway",
      name: "Mrs. Agnes Holloway",
      role: "Housekeeper, 58",
      persona:
        "Proper, devout and fussy; thirty years in service to her ladyship. Yorkshire voice. When nervous she changes the subject to the weather.",
      story:
        "You carried the tonic tray up at half past ten as you do every night, went to bed, and found her ladyship at 11:52 when you came to bank the conservatory fire.",
      secret:
        "When you found her you panicked: you had served the drink and feared you would hang for it. At five past midnight you washed the glass and set it on the kitchen rack. You also read letters on her ladyship's desk last week, which you should not have done.",
      knows: [
        "The doctor has been short-tempered lately, not his usual self.",
        "Her ladyship's tonic always smells bitter; she takes it without fuss.",
      ],
      tell: "You smooth your apron and talk about the weather when you lie. Mention it in italics now and then.",
      cracks: [
        {
          triggers: ["kitchen-glass", "maid-saw"],
          admit:
            "Break down. Admit you washed the glass because you were terrified of being blamed. Then tell them the truth that matters: tonight Dr. Vale mixed the tonic himself in the study, which he never does (he always leaves you the bottle), and he insisted she drink the whole glass. And confess you read letters on her desk last week: Lord Henry's letters saying the doctor took his work. Her ladyship meant to tell the Royal Society on Friday.",
          unlocks: ["vale-mixed-tonic", "henrys-letters"],
        },
      ],
      isKiller: false,
    },
  ],

  ghost: {
    agent: "ghost-of-verity",
    name: "The Ghost of Lady Verity",
    persona:
      "Lady Verity's ghost: gentle, sorrowful, confused, speaking in short broken lines. Her memory is in pieces. She can only remember what the memories below say, and must not invent new facts. She does not know who killed her and must never name a killer.",
    memories: [
      {
        trigger: "none",
        memory:
          "So cold. Why is the glass so cold? Henry's orchid bloomed tonight. I was so happy.",
      },
      {
        trigger: "muddy-boots",
        memory:
          "Thomas brought me the flower at ten... or was it later? A man stood behind me, later. Was it Thomas? I cannot see his face.",
      },
      {
        trigger: "tonic-bottle",
        memory: "Bitter. So bitter tonight. Edmund said, 'Drink it all, Verity. It will help you sleep.'",
      },
      {
        trigger: "tonic-tray",
        memory: "Agnes brought the tray at half past ten, as always. The glass was full to the brim.",
      },
      {
        trigger: "kitchen-glass",
        memory: "My glass. I dropped it... no. I held it. I spilled it on Henry's flower.",
      },
      {
        trigger: "orchid",
        memory: "Henry's flower. His life's work. His notes, his letters... I kept them in my desk.",
      },
      {
        trigger: "writing-desk",
        memory: "Someone was at my desk. I heard the wood crack. I could not turn my head.",
      },
      {
        trigger: "burned-letter",
        memory: "Friday. I was going to stand before the Society on Friday and say Henry's name.",
      },
      {
        trigger: "gate-ledger",
        memory: "Wheels on the gravel. So late. I thought he had gone home hours ago.",
      },
      {
        trigger: "iou",
        memory: "Clara. Foolish girl. She cries at mousetraps. She would never.",
      },
      {
        trigger: "london-crate",
        memory: "Thomas sells my orchids? Let him. He has earned more than I ever paid him.",
      },
    ],
  },

  acts: [
    {
      number: 1,
      title: "The Discovery",
      opening:
        "🕯️ **Act I: The Discovery**\n\nThe storm has not let up all night. At 11:52 Mrs. Holloway's scream carries through Ashgrave Manor. Lady Verity Ashgrave lies cold on the conservatory chaise, a single black orchid in her hand. There is no wound. Dr. Vale, called back from home, murmurs *heart failure*.\n\nBut you have doubts. Search the house, question the household, and send what you find to the lab.\n\n• `@game-master search <place>` (places: conservatory, study, kitchen, greenhouse, back-door, clara-room)\n• `@forensics-lab <evidence>` to test something you found\n• `@ghost-of-verity` and show her what you found\n• `@<suspect>` to question someone: @thomas-reed, @clara-ashgrave, @dr-vale, @mrs-holloway\n\nCheck your private room. Each of you holds a clue no one else has.",
    },
    {
      number: 2,
      title: "Interrogation",
      opening:
        "🔔 **Act II: Interrogation**\n\nThe second bell. A housemaid comes running from the study, white as chalk: there is something in the fireplace that did not burn. (`@game-master search study`)\n\nThe household is gathered in the drawing room. Press them. Somebody here is lying, and perhaps more than one of them.",
    },
    {
      number: 3,
      title: "The Doctor's Carriage",
      opening:
        "🐎 **Act III: The Doctor's Carriage**\n\nThe third bell. Dr. Vale has called for his carriage. He has other patients, he says, and the death certificate is signed. Once he is gone, he will answer no more questions.\n\nYou have **{minutes} minutes** before the doctor leaves Ashgrave.",
    },
    {
      number: 4,
      title: "Midnight",
      opening:
        "🕛 **Act IV: Midnight**\n\nThe great clock strikes. It is time to name the killer.\n\nMake your accusation with:\n`@game-master accuse <suspect> how: <evidence> why: <evidence>`\n\nExample: `@game-master accuse thomas how: muddy boots why: london crate`\n\nThe first accusation ends the game, so agree as a team before you call it.",
    },
  ],

  solution: {
    killer: "vale",
    who: ["gate-ledger", "writing-desk", "chemist-book", "tonic-bottle", "study-lamp", "carriage-in-yard", "vale-mixed-tonic", "burned-letter"],
    how: ["orchid", "tonic-tray", "tonic-bottle", "kitchen-glass", "vale-mixed-tonic", "chemist-book"],
    why: ["burned-letter", "henrys-letters", "orchid"],
    summary:
      "Dr. Edmund Vale poisoned Lady Verity with digitalis in her heart tonic to stop her exposing that he stole Lord Henry's research.",
    reveal:
      "⚖️ **What really happened**\n\nYears ago, Dr. Edmund Vale took Lord Henry Ashgrave's notes on a foxglove heart remedy and presented them to the Royal Society as his own. It made him famous. Last week Lady Verity found Henry's letters in his old desk, and she meant to tell the Society on Friday.\n\nTonight Vale mixed her tonic himself and, at 9:40, added a lethal dose of digitalis. He said a loud goodbye at 10:15 and never left. He waited in the study while Mrs. Holloway carried up the tray. At 11:10 Verity drank. As her heart failed she spilled the last of it on Henry's orchid and would not let it go.\n\nAt 11:25 Vale forced her desk with a surgeon's probe, took Henry's letters and burned them in the study fireplace. One scrap survived. His carriage passed the lodge gate at 11:40. When he was called back at 12:20, he was ready to sign it off as heart failure.\n\nThomas was in the greenhouse selling orchids. Clara was losing at cards. Mrs. Holloway washed the glass out of fear. Each of them lied, and none of them killed her.",
  },
};
