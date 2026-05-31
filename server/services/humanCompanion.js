// Human companion engine — accurate contextual replies when Gemini is unavailable.
const crypto = require('crypto');
const { humanizeReply } = require('./voiceRules');
const { lookupFactualAnswer, isFactualQuestion } = require('./knowledgeService');

const CBT_CONVERSATIONAL = {
  Catastrophizing:
    "Honestly your mind might be jumping to the worst case right now — that's such a human thing when you're scared. Want to zoom out together for a second?",
  'Overgeneralization / All-or-Nothing Thinking':
    "I'm picking up some absolute thinking — always, never, that kind of thing. Want to see if there's even one tiny exception?",
  'Mind Reading':
    "Sounds like you're assuming what they think or feel without being sure — that gets lonely fast. What do you actually know for certain here?",
  'Should Statements':
    "There's a lot of pressure in those shoulds — what if you talked to yourself the way you'd talk to a close friend?",
  'Mental Filter / Discounting Positives':
    "Feels like your mind is only clocking what went wrong — even one small okay moment counts. Can you think of one?",
  'Emotional Reasoning':
    "Because it feels true doesn't always mean it is — your feeling is completely valid, but the story might be harsher than reality.",
};

function pick(options, seed) {
  if (!options.length) return '';
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return options[parseInt(hash.slice(0, 8), 16) % options.length];
}

function pickAvoiding(options, seed, avoidText) {
  if (!avoidText) return pick(options, seed);
  const filtered = options.filter(
    (o) => o !== avoidText && !avoidText.includes(o.slice(0, 25)) && !o.includes(avoidText.slice(0, 25))
  );
  return pick(filtered.length ? filtered : options, seed);
}

function firstName(name) {
  if (!name || name.toLowerCase() === 'user') return null;
  return name.split(' ')[0];
}

function recentUserMessages(conversationMessages, n = 4) {
  return conversationMessages.filter((m) => m.sender === 'user').slice(-n).map((m) => m.text);
}

function lastAiMessage(conversationMessages) {
  return [...conversationMessages].reverse().find((m) => m.sender === 'ai')?.text || '';
}

function isSmallTalk(text) {
  const t = text.trim().toLowerCase();
  if (/^(hi|hello|hey|good morning|good evening|yo|sup)[\s!.,?]*$/i.test(t)) return 'greeting';
  if (/^(thanks|thank you|thx|ty)[\s!.,?]*$/i.test(t)) return 'thanks';
  if (['ok', 'okay', 'k', 'cool', 'got it', 'alright', 'nothing'].includes(t)) return 'ack';
  return null;
}

function isMetaAboutBot(text) {
  const lower = text.toLowerCase();
  return (
    /why do you (want|need|ask|care)/.test(lower) ||
    /what do you want/.test(lower) ||
    /what should i do/.test(lower) ||
    /why are you asking/.test(lower) ||
    /who are you/.test(lower) ||
    /are you (real|human|a bot|an ai)/.test(lower)
  );
}

function isEmotionalContext(text, textEmotion) {
  if (textEmotion === 'Distress Detected' || textEmotion === 'Mild Negative') return true;
  const lower = text.toLowerCase();
  return /sad|anxious|depressed|lonely|stressed|overwhelm|hurt|worried|cry|scared|hopeless|tired|empty|fight|argued|upset|angry|betrayed|ignored|abandoned/.test(lower) ||
    /doesn't care|does not care|don't care|dont care|not care about me|hates me|ignore me/.test(lower);
}

function threadIsAboutFriends(conversationMessages) {
  const combined = recentUserMessages(conversationMessages, 5).join(' ').toLowerCase();
  return /friend|fight|argued|argument|best friend/.test(combined);
}

function answerMetaQuestion(text, userName, avoid) {
  const name = firstName(userName);
  const lower = text.toLowerCase();

  if (/why do you (want|need|ask|care)/.test(lower)) {
    return pickAvoiding(
      [
        `${name ? `${name}, ` : ''}fair question — I'm not trying to pry. I ask because what you actually mean matters more than a quick reply.`,
        "Honestly? I'm not fishing for drama. I just don't want to give you a generic answer when something specific might be going on.",
      ],
      text,
      avoid
    );
  }

  if (/what do you want/.test(lower)) {
    return pickAvoiding(
      [
        "From me? Nothing you don't want to give. Ask me anything, vent, or just talk — no agenda.",
        "I don't want anything from you — I'm on your side.",
      ],
      text,
      avoid
    );
  }

  if (/what should i do/.test(lower)) {
    return pickAvoiding(
      [
        "Depends what's going on — but naming what's actually bothering you, without judging it, is usually a solid first step. What's the one thing that feels stuck?",
        "What's the smallest next step that wouldn't feel overwhelming?",
      ],
      text,
      avoid
    );
  }

  if (/who are you|are you (real|human|a bot)/.test(lower)) {
    return "I'm NeuroWell — a really knowledgeable friend who's here for anything: homework, life stuff, or when you're low.";
  }

  return null;
}

function answerEmotionalSituation(text, conversationMessages, textEmotion, cognitiveDistortion, ragContext, avoid) {
  const lower = text.toLowerCase();
  const parts = [];
  const friendThread = threadIsAboutFriends(conversationMessages) || /friend/.test(lower);

  if ((/fight|argued|argument|falling out/.test(lower) && friendThread) || (/fight/.test(lower) && /friend/.test(lower))) {
    return pickAvoiding(
      [
        "Fights with close friends hit different — especially when you're left feeling like they don't care. That really hurts. What happened, if you want to walk me through it?",
        "Yeah, falling out with a friend can feel awful — like the ground shifted under you. What went down between you two?",
      ],
      text,
      avoid
    );
  }

  if (/doesn't care|does not care|don't care|dont care|not care about me|doesnt care/.test(lower)) {
    const mindReading = cognitiveDistortion === 'Mind Reading' || /he |she |they /.test(lower);
    if (mindReading) {
      return pickAvoiding(
        [
          "That's a painful feeling — like you're invisible to someone who should see you. I hear that. Sometimes we're sure they don't care before we've heard their side though. What happened that made you feel that way?",
          "It makes complete sense you'd feel hurt if it seems like they don't care. That's lonely. What did they do or say — or not say?",
        ],
        text,
        avoid
      );
    }
  }

  if (friendThread && !isFactualQuestion(text)) {
    return pickAvoiding(
      [
        "Friend stuff can cut deep — especially when you feel unseen. I'm listening. What's weighing on you most about this?",
        "Yeah, when someone close hurts you it stays with you. Tell me more about what happened.",
      ],
      text,
      avoid
    );
  }

  const reflections = {
    'Distress Detected': [
      "That sounds really tough — and it makes complete sense that you'd feel this way.",
      "I hear you. That takes real courage to say out loud.",
    ],
    'Mild Negative': [
      "Sounds like something's been sitting with you — not huge maybe, but real.",
      "There's a quiet weight in what you shared, and that's worth paying attention to.",
    ],
    Positive: ["Honestly it's good to hear a lighter note from you."],
    Balanced: ["I hear you.", "Yeah, I'm with you on that."],
  };

  parts.push(pickAvoiding(reflections[textEmotion] || reflections.Balanced, text + textEmotion, avoid));

  if (cognitiveDistortion !== 'None' && CBT_CONVERSATIONAL[cognitiveDistortion]) {
    parts.push(CBT_CONVERSATIONAL[cognitiveDistortion]);
  } else if (ragContext?.content && textEmotion !== 'Balanced') {
    parts.push(ragContext.content.split('. ').slice(0, 2).join('. ') + '.');
  } else {
    parts.push(
      pickAvoiding(
        [
          "What's the part of this that feels heaviest right now?",
          "What do you need most — to be heard, or to figure out a next step?",
        ],
        text,
        avoid
      )
    );
  }

  return parts.join(' ');
}

async function buildHumanResponse(contextPayload) {
  const {
    userText,
    userName,
    textEmotion,
    cognitiveDistortion,
    contradiction,
    ragContext,
    conversationMessages = [],
  } = contextPayload;

  const text = userText.trim();
  const lower = text.toLowerCase();
  const avoid = lastAiMessage(conversationMessages);

  const small = isSmallTalk(text);
  if (small === 'greeting') {
    const name = firstName(userName);
    return humanizeReply(`${name ? `Hey ${name}! ` : 'Hey! '}What's on your mind?`);
  }
  if (small === 'thanks') return humanizeReply('Anytime — glad that helped.');
  if (small === 'ack') {
    if (lower === 'nothing') {
      return humanizeReply(
        pickAvoiding(
          [
            "That's okay — sometimes 'nothing' still means something's there quietly. We can sit with that, or switch topics.",
            "Fair enough. No pressure here. Want to talk about something completely different?",
          ],
          text,
          avoid
        )
      );
    }
    return humanizeReply("Got it. I'm here whenever.");
  }

  if (contradiction?.contradictionDetected) {
    const faceFeel = contradiction.detectedEmotions?.facial_emotion_human || 'a little heavy';
    const name = firstName(userName);
    return humanizeReply(
      `${name ? `${name}, ` : ''}you said you're fine, but you seem ${faceFeel} right now — and that's completely okay. Want to talk about what's really going on?`
    );
  }

  const meta = answerMetaQuestion(text, userName, avoid);
  if (meta) return humanizeReply(meta);

  // Factual questions always get real answers first — even mid emotional conversation
  if (isFactualQuestion(text)) {
    const factual = await lookupFactualAnswer(text);
    if (factual) return humanizeReply(factual);

    if (/how are you/.test(lower)) {
      return humanizeReply("I'm good — thanks for asking. How are you doing right now?");
    }
    if (/what can you do|what do you do/.test(lower)) {
      return humanizeReply('Pretty much anything — coding, science, history, life stuff, or just talking through how you feel.');
    }
  }

  if (isEmotionalContext(text, textEmotion)) {
    return humanizeReply(
      answerEmotionalSituation(text, conversationMessages, textEmotion, cognitiveDistortion, ragContext, avoid)
    );
  }

  if (text.endsWith('?')) {
    const factual = await lookupFactualAnswer(text);
    if (factual) return humanizeReply(factual);

    return humanizeReply(
      pickAvoiding(
        [
          "Good question — give me a bit more context and I'll answer properly.",
          "Yeah, I want to answer that well. What's the situation behind it?",
        ],
        text,
        avoid
      )
    );
  }

  return humanizeReply(
    pickAvoiding(
      [
        "Tell me more — what's going on with that?",
        "Yeah, go on — I'm listening.",
        "What's behind that for you?",
      ],
      text,
      avoid
    )
  );
}

function isValidGeminiKey(key) {
  if (!key || key.length < 20) return false;
  if (/your_gemini|placeholder|example|xxx/i.test(key)) return false;
  return true;
}

module.exports = { buildHumanResponse, isValidGeminiKey, CBT_CONVERSATIONAL };
