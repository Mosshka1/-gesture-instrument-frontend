import { MODES } from '../audio/modes';
import type { PlayStats } from './stats';

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  icon: string; // назва в Glyph
  done: boolean;
  progress?: string; // наприклад «3 / 9»
  local: boolean; // залежить лише від локальної статистики (про такі можна сповістити під час гри)
};

export type AchievementInput = {
  stats: PlayStats;
  presets: number;
  recordings: number;
  shared: number;
  sounds: number;
  calibrated: boolean;
};

export function computeAchievements({ stats, presets, recordings, shared, sounds, calibrated }: AchievementInput): Achievement[] {
  const tried = Object.keys(stats.modeSeconds).filter((id) => MODES.some((m) => m.id === id) && stats.modeSeconds[id] >= 5).length;
  const total = MODES.length;
  const min = stats.playSeconds / 60;
  const prog = (v: number, goal: number) => `${Math.min(v, goal)} / ${goal}`;

  return [
    { id: 'first-notes', title: 'Перші ноти', desc: 'Зіграй перші секунди рукою в повітрі', icon: 'hands', done: stats.playSeconds >= 5, local: true },
    { id: 'play-10', title: 'Розігрів', desc: 'Награй 10 хвилин', icon: 'bolt', done: min >= 10, progress: prog(Math.floor(min), 10), local: true },
    { id: 'play-60', title: 'Година музики', desc: 'Награй загалом годину', icon: 'sun', done: min >= 60, progress: prog(Math.floor(min), 60), local: true },
    { id: 'modes-3', title: 'Розвідка звуку', desc: 'Спробуй 3 різні режими', icon: 'grid', done: tried >= 3, progress: prog(tried, 3), local: true },
    { id: 'modes-all', title: 'Усі режими', desc: 'Спробуй кожен режим інструмента', icon: 'choir', done: tried >= total, progress: prog(tried, total), local: true },
    { id: 'looper-3', title: 'Оркестр з однієї руки', desc: 'Збери в лупері 3 шари', icon: 'rec', done: stats.maxLayers >= 3, progress: prog(stats.maxLayers, 3), local: true },
    { id: 'calibrated', title: 'Інструмент під руку', desc: 'Відкалібруй трекінг', icon: 'spread', done: calibrated, local: false },
    { id: 'first-preset', title: 'Свій стиль', desc: 'Збережи перший пресет', icon: 'sliders', done: presets >= 1, local: false },
    { id: 'presets-5', title: 'Колекція пресетів', desc: 'Збережи 5 пресетів', icon: 'grid', done: presets >= 5, progress: prog(presets, 5), local: false },
    { id: 'first-rec', title: 'Перший запис', desc: 'Збережи свою першу мелодію', icon: 'note', done: recordings >= 1, local: false },
    { id: 'recs-5', title: 'Альбом', desc: 'Збережи 5 записів', icon: 'note', done: recordings >= 5, progress: prog(recordings, 5), local: false },
    { id: 'shared', title: 'Музика для всіх', desc: 'Надішли комусь посилання на запис', icon: 'share', done: shared >= 1, local: false },
    { id: 'own-sound', title: 'Власний голос', desc: 'Додай свій звук або звук з Freesound', icon: 'volume', done: sounds >= 1, local: false },
  ];
}
