import journal from "./meta/_journal.json"
import m0000 from "./0000_cloudy_chimera.sql"
import m0001 from "./0001_cooing_wendigo.sql"

/** Embedded migrations executed separately inside every Durable Object. */
export default {
  journal,
  migrations: {
    m0000,
    m0001,
  },
}
