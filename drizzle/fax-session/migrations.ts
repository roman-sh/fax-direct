import journal from "./meta/_journal.json"
import m0000 from "./0000_clean_banshee.sql"
import m0001 from "./0001_sad_maverick.sql"
import m0002 from "./0002_futuristic_ricochet.sql"

/** Embedded migrations executed separately inside every Durable Object. */
export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
  },
}
