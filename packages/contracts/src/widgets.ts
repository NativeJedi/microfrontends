// The contract between the dashboard (host) and its widgets (remotes). Both sides import these types;
// the registry in the API describes which widgets exist, this file describes what a widget *is*.
//
// Every widget module exposed as `./Widget` must satisfy it: a default-exported component taking
// `WidgetProps`, plus a named export `meta` of type `WidgetMeta`.

/** Width of a widget in the dashboard grid, ordered from narrow to wide. */
export const WIDGET_SIZES = ['small', 'medium', 'large'] as const;

export type WidgetSize = (typeof WIDGET_SIZES)[number];

export interface WidgetMeta {
  /** Must equal the `id` of this widget's registry entry; the dashboard looks widgets up by it. */
  id: string;
  /**
   * The widget's own, non-localized name. The dashboard prefers its own translation for a known id
   * and falls back to this one, so a widget the host has never heard of still gets a readable title.
   */
  title: string;
  /** Size used when the saved layout has no entry for this widget yet. */
  defaultSize: WidgetSize;
  /** The widget refuses to be narrower than this; the dashboard clamps every size against it. */
  minSize: WidgetSize;
}

/**
 * Per-widget configuration, owned by the dashboard layout and stored by the API. The dashboard cannot
 * know the shape of any widget's settings, so values cross the boundary as `unknown` and the widget
 * that owns them narrows them (SPEC section 6: `unknown` + narrowing at MF boundaries).
 */
export type WidgetSettings = Readonly<Record<string, unknown>>;

export interface WidgetProps {
  settings: WidgetSettings;
  /** The size the widget is being rendered at, so it can show more or less inside the same card. */
  size: WidgetSize;
}

/** Never widens below `minSize`: a saved layout may hold a size the widget no longer accepts. */
export function clampWidgetSize(size: WidgetSize, minSize: WidgetSize): WidgetSize {
  return WIDGET_SIZES.indexOf(size) < WIDGET_SIZES.indexOf(minSize) ? minSize : size;
}
