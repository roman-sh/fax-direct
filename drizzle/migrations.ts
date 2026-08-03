import journal from "./meta/_journal.json"
import m0000 from "./0000_clean_banshee.sql"

/** Embedded migrations executed separately inside every Durable Object. */
export default {
  journal,
  migrations: {
    m0000,
  },
}
