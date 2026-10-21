import type { Units } from './database.types';
import { formatDecimal, formatInt } from './format';

// Everything is stored metric. These convert for display and back for input.
const KM_PER_MI = 1.609344;
const KG_PER_LB = 0.45359237;

export const distanceUnit = (u: Units) => (u === 'imperial' ? 'mi' : 'km');
export const weightUnit = (u: Units) => (u === 'imperial' ? 'lb' : 'kg');

export const kmToDisplay = (km: number, u: Units) => (u === 'imperial' ? km / KM_PER_MI : km);
export const displayToKm = (v: number, u: Units) => (u === 'imperial' ? v * KM_PER_MI : v);

export const kgToDisplay = (kg: number, u: Units) => (u === 'imperial' ? kg / KG_PER_LB : kg);
export const displayToKg = (v: number, u: Units) => (u === 'imperial' ? v * KG_PER_LB : v);

/** "5.2 km" or "3.2 mi" */
export const formatDistance = (km: number, u: Units) => `${formatDecimal(kmToDisplay(km, u))} ${distanceUnit(u)}`;

/** "22.5 kg" or "49.6 lb" */
export const formatWeight = (kg: number, u: Units) => `${formatDecimal(kgToDisplay(kg, u))} ${weightUnit(u)}`;

/** A large total weight, rounded to whole units with separators: "3,200 kg". */
export const formatLoadTotal = (kg: number, u: Units) => `${formatInt(kgToDisplay(kg, u))} ${weightUnit(u)}`;
