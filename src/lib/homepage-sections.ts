/**
 * Homepage builder section shapes and row normalisation.
 *
 * This module must stay free of "use client": the admin homepage server page
 * normalises database rows before passing them to the client builder, and
 * calling a function exported from a client module on the server is a render
 * error (HTTP 500).
 */

export interface Section {
  id?: string;
  sectionType: string;
  isVisible: boolean;
  desktopVisible: boolean;
  mobileVisible: boolean;
  config: Record<string, any>;
}

export function normalizeSection(row: any): Section {
  return {
    id: row.id,
    sectionType: row.sectionType,
    isVisible: row.isVisible ?? true,
    desktopVisible: row.desktopVisible ?? true,
    mobileVisible: row.mobileVisible ?? true,
    config: row.config ?? {},
  };
}
