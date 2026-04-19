// Dev-mode RSC entry: imports both prefix handlers so their eager globs
// register server actions with plugin-rsc's manifest. Also re-exports
// SSG helpers for the ssg-plugin.
import '../server/admin/rsc-entry'
import '../server/public/rsc-entry'
export { getStaticPaths, handleSsg } from './ssg-entry'
