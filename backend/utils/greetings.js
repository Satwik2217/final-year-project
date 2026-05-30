const LOGIN_GREETINGS = [
  (name) => `Hey ${name} — good to see you. I'm here when you're ready to talk.`,
  (name) => `Hi ${name}. Take your time — what's on your mind today?`,
  (name) => `${name}, I'm glad you're here. How are you feeling?`,
];

function pickLoginGreeting(name, userId) {
  const first = name?.split(' ')[0] || 'there';
  const index = userId ? userId.length % LOGIN_GREETINGS.length : 0;
  return LOGIN_GREETINGS[index](first);
}

module.exports = { pickLoginGreeting };
