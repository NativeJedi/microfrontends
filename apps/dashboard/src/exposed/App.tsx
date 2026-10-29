import { Route, Routes } from 'react-router';
import DashboardGrid from '../grid/DashboardGrid';
import { useDashboardTranslation } from '../i18n/use-dashboard-translation';
import WidgetAppRoute from '../widgets/WidgetAppRoute';

function UnknownRoute() {
  const t = useDashboardTranslation();
  return <p>{t('notFound')}</p>;
}

/**
 * A remote of the shell and a host of the widgets — and now a router level of its own. The shell mounts
 * this app at `/dashboard/*` and matches nothing below it; these <Routes> are *descendant* routes, so they
 * see only the part of the URL after the mount point and never learn where they are mounted.
 *
 * A widget that is a whole application (one that also exposes `./App`) is mounted under its own id, with
 * a splat of its own: the widget then routes a third time, inside `/dashboard/orders/*`.
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<DashboardGrid />} />
      <Route path=":widgetId/*" element={<WidgetAppRoute />} />
      <Route path="*" element={<UnknownRoute />} />
    </Routes>
  );
}
