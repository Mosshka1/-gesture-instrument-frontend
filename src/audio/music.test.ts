import { describe, expect, it } from 'vitest';
import { SCALES, NOTE_NAMES, chordLabel, clamp, clamp01, freqToLabel, lerp, midiToFreq, scaleLength, scaleMidi } from './music';
import type { ScaleId } from './music';

describe('midiToFreq', () => {
  it('ля першої октави (MIDI 69) = 440 Гц', () => expect(midiToFreq(69)).toBeCloseTo(440, 5));
  it('октава вгору подвоює частоту', () => expect(midiToFreq(81)).toBeCloseTo(880, 5));
  it('до середньої октави (MIDI 60) ≈ 261.63 Гц', () => expect(midiToFreq(60)).toBeCloseTo(261.63, 2));
});

describe('freqToLabel', () => {
  it('440 Гц — A4', () => expect(freqToLabel(440)).toBe('A4'));
  it('261.63 Гц — C4', () => expect(freqToLabel(261.63)).toBe('C4'));
  it('нуль і від’ємні значення — тире', () => {
    expect(freqToLabel(0)).toBe('—');
    expect(freqToLabel(-5)).toBe('—');
  });
  it('круговий зв’язок із midiToFreq для всіх нот однієї октави', () => {
    for (let m = 60; m < 72; m++) {
      expect(freqToLabel(midiToFreq(m))).toBe(NOTE_NAMES[m % 12] + '4');
    }
  });
});

describe('scaleMidi', () => {
  it('нульова ступінь мажору від C = базова нота', () => expect(scaleMidi('major', 0, 0)).toBe(48));
  it('сьома ступінь мажору — септима', () => expect(scaleMidi('major', 0, 6)).toBe(48 + 11));
  it('ступінь за межами гами переходить в наступну октаву', () => {
    expect(scaleMidi('major', 0, 7)).toBe(48 + 12);
    expect(scaleMidi('pentatonic', 0, 5)).toBe(48 + 12);
  });
  it('від’ємні ступені йдуть вниз', () => {
    expect(scaleMidi('major', 0, -1)).toBe(48 - 1);
    expect(scaleMidi('major', 0, -7)).toBe(48 - 12);
  });
  it('тональність зсуває всі ноти', () => expect(scaleMidi('minor', 9, 0)).toBe(48 + 9));
  it('кожна гама має кроки в межах октави й по зростанню', () => {
    for (const id of Object.keys(SCALES) as ScaleId[]) {
      const steps = SCALES[id].steps;
      expect(steps[0]).toBe(0);
      expect(steps.every((v, i) => i === 0 || v > steps[i - 1])).toBe(true);
      expect(steps[steps.length - 1]).toBeLessThan(12);
      expect(scaleLength(id)).toBe(steps.length);
    }
  });
});

describe('chordLabel', () => {
  it('мажор', () => expect(chordLabel([60, 64, 67])).toBe('C'));
  it('мінор', () => expect(chordLabel([57, 60, 64])).toBe('Am'));
  it('зменшений', () => expect(chordLabel([59, 62, 65])).toBe('Bdim'));
  it('збільшений', () => expect(chordLabel([60, 64, 68])).toBe('Caug'));
});

describe('clamp / clamp01 / lerp', () => {
  it('clamp обрізає значення', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it('clamp01', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
  });
  it('lerp', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});
