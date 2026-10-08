/* Built-in exercise library and the default push/pull program.
   The data file can extend or override any of this:
   - customEx[id]  adds a new exercise or overrides fields of a built-in one
   - program[day]  replaces the default exercise list for a day type */

export const EX = {
  pullup: {
    name: 'Pull-ups', day: 'pull', sets: 3, reps: 'Max', repDefault: 8, kg: null, rest: 150,
    m: 'Lats · biceps', mus: { p: ['lats'], s: ['biceps', 'midback'] },
    desc: 'The best back-width move — lats do the pulling, biceps and grip assist. Take every set close to your max.',
    how: ['Hang from the bar, hands just wider than shoulders.',
      'Pull until your chin clears the bar, chest up.',
      'Lower all the way down — full hang each rep.'],
  },
  row: {
    name: 'One-Arm Dumbbell Row', day: 'pull', sets: 3, reps: '8–12 / arm', repDefault: 10, kg: 16, rest: 120,
    m: 'Lats · mid-back', mus: { p: ['lats', 'midback'], s: ['biceps', 'forearms'] }, perArm: true,
    desc: 'Builds back thickness one side at a time. Brace your free hand on the ottoman and row without twisting. Log reps per arm.',
    how: ['One knee and hand on the ottoman, back flat, dumbbell hanging.',
      'Pull the dumbbell to your hip, elbow close to your body.',
      'Lower slowly to a full stretch. Do all reps, then switch arms.'],
  },
  hammer: {
    name: 'Hammer Curls', day: 'pull', sets: 3, reps: '10–12', repDefault: 11, kg: 11.5, rest: 90,
    m: 'Biceps · forearms', mus: { p: ['biceps'], s: ['forearms'] },
    desc: 'Neutral-grip curls that hit the brachialis and forearms along with the biceps — thicker-looking arms.',
    how: ['Stand tall, dumbbells at your sides, palms facing in.',
      'Curl both dumbbells up, keeping the neutral grip.',
      'Lower slowly without swinging your hips.'],
  },
  conc: {
    name: 'Concentration Curls', day: 'pull', sets: 3, reps: '8–12', repDefault: 10, kg: 11.5, rest: 75,
    m: 'Biceps', mus: { p: ['biceps'], s: ['forearms'] },
    desc: 'Strict, isolated biceps work — the elbow braced against your thigh removes all momentum.',
    how: ['Sit on the ottoman, elbow braced against your inner thigh.',
      'Curl the dumbbell up without moving your upper arm.',
      'Lower slowly — the way down builds as much muscle.'],
  },
  floorpress: {
    name: 'Dumbbell Floor Press', day: 'push', sets: 3, reps: '8–12', repDefault: 10, kg: 14, rest: 150,
    m: 'Chest · triceps', mus: { p: ['chest'], s: ['triceps', 'shoulders'] },
    desc: 'Your main press without a bench — the floor stops the elbows at a shoulder-friendly depth and emphasises chest and triceps.',
    how: ['Lie on the floor, knees bent, dumbbells over your chest.',
      'Lower with control until your upper arms rest on the floor.',
      'Pause briefly, then press back up to lockout.'],
  },
  inclinepu: {
    name: 'Incline Push-ups', day: 'push', sets: 3, reps: '12–15', repDefault: 13, kg: null, rest: 90,
    m: 'Chest · shoulders', mus: { p: ['chest'], s: ['shoulders', 'triceps', 'core'] },
    desc: 'Hands on the ottoman, feet on the floor — a chest press through a long range that finishes the pecs after floor presses.',
    how: ['Hands on the ottoman edge, body in one straight line.',
      'Lower your chest to the edge, elbows about 45° from your body.',
      'Press back up without letting the hips sag.'],
  },
  ohp: {
    name: 'Overhead Press', day: 'push', sets: 3, reps: '8–12', repDefault: 10, kg: 11.5, rest: 120,
    m: 'Shoulders · triceps', mus: { p: ['shoulders'], s: ['triceps', 'traps', 'core'] },
    desc: 'Standing dumbbell press — builds all three heads of the shoulder while your core keeps you from arching.',
    how: ['Stand tall, dumbbells at ear height, palms forward.',
      'Press overhead until your arms are straight — squeeze your glutes, don’t arch.',
      'Lower back to ear level with control.'],
  },
  latraise: {
    name: 'Lateral Raises', day: 'push', sets: 3, reps: '12–15', repDefault: 13, kg: 6, rest: 75,
    m: 'Side delts', mus: { p: ['shoulders'], s: ['traps'] },
    desc: 'Isolates the side delts — the muscle that makes shoulders look wide. Light weight, strict form.',
    how: ['Stand with a dumbbell in each hand at your sides.',
      'Raise out to shoulder height, elbows soft.',
      'Lower slowly — no swinging.'],
  },
  kneeraise: {
    name: 'Hanging Knee Raises', day: 'push', sets: 3, reps: '10–15', repDefault: 12, kg: null, rest: 75,
    m: 'Core · grip', mus: { p: ['core'], s: ['forearms'] },
    desc: 'Hang from the pull-up bar and curl your knees up — trains the abs hard and builds grip as a bonus.',
    how: ['Dead hang from the bar, shoulders packed down.',
      'Raise your knees to hip height or higher, tilting the pelvis up.',
      'Lower slowly — no swinging between reps.'],
  },
};

export const DEFAULT_PROGRAM = {
  pull: ['pullup', 'row', 'hammer', 'conc'],
  push: ['floorpress', 'inclinepu', 'ohp', 'latraise', 'kneeraise'],
};

export const DAY_LABEL = { pull: 'Pull', push: 'Push', rest: 'Rest', other: 'Custom' };

export const MUSCLES = ['chest', 'shoulders', 'triceps', 'biceps', 'forearms', 'lats', 'midback',
  'traps', 'lowerback', 'core', 'glutes', 'quads', 'hams', 'calves'];

export const MUSCLE_LABEL = {
  chest: 'Chest', shoulders: 'Shoulders', triceps: 'Triceps', biceps: 'Biceps', forearms: 'Forearms',
  lats: 'Lats', midback: 'Mid-back', traps: 'Traps', lowerback: 'Lower back', core: 'Core',
  glutes: 'Glutes', quads: 'Quads', hams: 'Hamstrings', calves: 'Calves',
};

export const WEEK_TARGET = 3; // workouts per week the progress ring aims at
