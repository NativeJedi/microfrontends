import {
  API_CLIENT_SERVICE,
  saveDashboardLayout,
  type DashboardLayout,
  type WidgetRegistryEntry,
} from '@mf/api-client';
import { WIDGET_SIZES, type WidgetSettings, type WidgetSize } from '@mf/contracts';
import { widgetKeys, widgetQueries } from '@mf/queries';
import { useService } from '@mf/services';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface DashboardWidget {
  id: string;
  /** Absent until the user has resized this widget: the widget's own `defaultSize` then applies. */
  size?: WidgetSize;
  settings: WidgetSettings;
}

const NO_SETTINGS: WidgetSettings = {};

// The stored size is a plain string: the API keeps layouts without knowing the widget contract.
function toWidgetSize(value: string | undefined): WidgetSize | undefined {
  return WIDGET_SIZES.find((size) => size === value);
}

/**
 * The registry decides which widgets exist, the layout decides their order, size and settings.
 * Widgets only in the layout are dropped (undeployed), widgets only in the registry are appended at
 * the end with no size — that is how a newly registered widget shows up without touching the layout.
 */
function mergeLayout(registry: WidgetRegistryEntry[], layout: DashboardLayout): DashboardWidget[] {
  const deployed = new Set(registry.map((entry) => entry.id));
  const placed = layout.widgets.filter((entry) => deployed.has(entry.id));
  const placedIds = new Set(placed.map((entry) => entry.id));

  return [
    ...placed.map((entry) => ({
      id: entry.id,
      size: toWidgetSize(entry.size),
      settings: entry.settings ?? NO_SETTINGS,
    })),
    ...registry
      .filter((entry) => !placedIds.has(entry.id))
      .map((entry) => ({ id: entry.id, settings: NO_SETTINGS })),
  ];
}

export function useDashboardLayout() {
  const api = useService(API_CLIENT_SERVICE);
  const queryClient = useQueryClient();
  const registry = useQuery(widgetQueries.registry(api));
  const layout = useQuery(widgetQueries.layout(api));

  const save = useMutation({
    mutationFn: (next: DashboardLayout) => saveDashboardLayout(api, next),
    // The select must follow the click, not the round trip; the server's answer replaces it below.
    onMutate: (next) => {
      queryClient.setQueryData(widgetKeys.layout(), next);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(widgetKeys.layout(), saved);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: widgetKeys.layout() });
    },
  });

  const widgets =
    registry.data && layout.data ? mergeLayout(registry.data, layout.data) : undefined;

  // The dashboard owns the layout, so it writes the whole list back: a widget that had no entry yet
  // gets one as soon as any widget is resized.
  function setSize(widgetId: string, size: WidgetSize) {
    if (!widgets) return;
    save.mutate({
      widgets: widgets.map((widget) => ({
        id: widget.id,
        size: widget.id === widgetId ? size : widget.size,
        settings: widget.settings,
      })),
    });
  }

  return {
    widgets,
    isPending: registry.isPending || layout.isPending,
    error: registry.error ?? layout.error,
    setSize,
  };
}
