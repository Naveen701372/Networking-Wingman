/**
 * Shared framer-motion animation variants for Recall V2.
 * All animations use ease-out easing and 200-300ms durations.
 */

import { Variants } from 'framer-motion';

/** Card appear: fade-in + slide up */
export const cardEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

/** Card content crossfade */
export const contentFade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

/** Search filter opacity */
export const searchDim: Variants = {
  match: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  dimmed: {
    opacity: 0.3,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

/** Group expand layout */
export const groupExpand: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

/** Suggestion pill slide-in from bottom */
export const pillSlide: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

/** Greeting card dismiss */
export const greetingDismiss: Variants = {
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -16,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

/** Staggered children container */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};
