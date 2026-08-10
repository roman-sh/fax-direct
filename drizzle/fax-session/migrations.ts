import journal from "./meta/_journal.json"
import m0000 from "./0000_cloudy_chimera.sql"

/** Embedded migrations executed separately inside every Durable Object. */
export default {
  journal,
  migrations: {
    m0000,
  },
}
