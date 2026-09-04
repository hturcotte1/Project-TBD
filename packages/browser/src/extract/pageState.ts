import { AUTHENTICATED_MARKER_SELECTOR, COMMONAPP_MAP, LOGIN_ERROR_MARKERS, MAINTENANCE_MARKERS, VERIFICATION_MARKERS } from '../commonapp-map';
import { bodyRaw, loadHtml } from './util';

export type PageState = 'login' | 'verification' | 'maintenance' | 'logged_in' | 'unknown';

/**
 * Classifies a captured page without knowing which page was requested — used to notice the site
 * redirected to a login/verification/maintenance page instead of the one asked for. Checked in
 * this order: maintenance (overrides everything), login, verification, authenticated, unknown.
 */
export function detectPageState(html: string): PageState {
  const $ = loadHtml(html);
  const text = bodyRaw($);

  if (MAINTENANCE_MARKERS.some((re) => re.test(text))) return 'maintenance';
  if ($(COMMONAPP_MAP.login.waitFor).length > 0 || LOGIN_ERROR_MARKERS.some((re) => re.test(text))) return 'login';
  if ($(COMMONAPP_MAP.verification.waitFor).length > 0 || VERIFICATION_MARKERS.some((re) => re.test(text))) return 'verification';
  if ($(AUTHENTICATED_MARKER_SELECTOR).length > 0) return 'logged_in';
  return 'unknown';
}
