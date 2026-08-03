import journal from "./meta/_journal.json"
import m0000 from "./0000_clean_banshee.sql"
import m0001 from "./0001_sad_maverick.sql"

/** Embedded migrations executed separately inside every Durable Object. */
export default {
  journal,
  migrations: {
    m0000,
    m0001,
  },
}
