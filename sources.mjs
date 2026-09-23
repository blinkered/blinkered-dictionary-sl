/**
 * The collections that attest Slovene, and where each comes from.
 *
 * Slovene has a 262,639-word candidate list, most of it inflected forms (Slovene keeps the dual,
 * so a noun has up to eighteen), and that is a list only a large corpus reaches the bottom of.
 * Expect the small families to be the ceiling.
 *
 * Slovene has no eBible translation, so its families are a Wikipedia with an unusually large
 * Wikisource, Leipzig's news and `.si` web, a very small Tatoeba, five Gutenberg texts, and the
 * Internet Archive's Slovene books.
 *
 * Every URL here was probed before it was written down. A collection that 404s does not fail
 * loudly; the build skips it with a warning and reports a healthy number over fewer families.
 */
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  fileDocuments,
  gutenbergBody,
  harvestDocuments,
  leipzigLocators,
  leipzigSentences,
  tatoebaDocuments,
  wikiDocuments,
} from '@blinkered/attestation'

export const LANGUAGE = 'sl'

const CACHE = new URL('.cache/raw/', import.meta.url).pathname

/** A Leipzig package, with its sentence-to-URL index resolved up front. */
function leipzig(pkg) {
  const base = `${CACHE}${pkg}/${pkg}`
  const locators = leipzigLocators(
    readFileSync(`${base}-inv_so.txt`, 'utf8'),
    readFileSync(`${base}-sources.txt`, 'utf8'),
  )
  const lines = createInterface({
    input: createReadStream(`${base}-sentences.txt`),
    crlfDelay: Infinity,
  })
  return leipzigSentences(lines, locators)
}

// News and `.si` web. The Leipzig Wikipedia packages are deliberately absent: they are Wikipedia
// text wearing a Leipzig label, so including one would corroborate `wiki:sl` while looking like
// another family. That is the exact failure the three-families rule exists to catch.
const LEIPZIG = ['slv_news_2020_1M', 'slv-si_web_2014_1M']

const ALL = [
  {
    id: 'wiki:sl',
    what: 'Slovene Wikipedia; modern encyclopedic prose',
    needs: `${CACHE}slwiki.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}slwiki.xml.bz2`),
  },
  {
    id: 'wikisource:sl',
    what: 'Slovene Wikisource; same Wikimedia family, so it corroborates rather than counts',
    needs: `${CACHE}slwikisource.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}slwikisource.xml.bz2`),
  },
  ...LEIPZIG.map((pkg) => ({
    id: `lz:${pkg}`,
    from: `https://downloads.wortschatz-leipzig.de/corpora/${pkg}.tar.gz`,
    what: `Leipzig ${pkg}; news and web, cited by the page each sentence came from`,
    needs: `${CACHE}${pkg}`,
    documents: () => leipzig(pkg),
  })),
  {
    id: 'tat',
    from: 'https://downloads.tatoeba.org/exports/per_language/slv/slv_sentences.tsv.bz2',
    what: 'Tatoeba Slovene; contemporary and conversational, and small',
    needs: `${CACHE}slv_sentences.tsv`,
    documents: () => tatoebaDocuments(`${CACHE}slv_sentences.tsv`),
  },
  {
    id: 'gut',
    from: 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv',
    what: 'Project Gutenberg Slovene, 5 texts',
    needs: `${CACHE}gutenberg-sl`,
    documents: () => {
      const dir = `${CACHE}gutenberg-sl`
      const books = readdirSync(dir)
        .filter((file) => file.endsWith('.txt'))
        .map((file) => ({ locator: file.replace('.txt', ''), path: `${dir}/${file}` }))
      return fileDocuments(books, async (path) => gutenbergBody(readFileSync(path, 'utf8')))
    },
  },
  {
    id: 'ia',
    // Scanned books are OCR, and OCR fails in a way that looks like text. Clean Gutenberg scores
    // a median 52% known words and never below 36%; the worst Archive scans score 1%. Below this
    // floor a book is not legible enough to attest anything.
    legible: 0.35,
    what: 'Internet Archive Slovene books; literature, and the register a newspaper never reaches',
    needs: `${CACHE}archive-sl`,
    from: 'https://archive.org/search?query=mediatype%3Atexts+AND+%28language%3A%22Slovenian%22+OR+language%3Aslv%29',
    documents: () => {
      const dir = `${CACHE}archive-sl`
      // A locator names the text, not the item: the catalogue page holds no word of the book.
      const named = new Map(
        readFileSync(`${dir}/files.tsv`, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => line.split('\t')),
      )
      const books = readdirSync(dir)
        .filter((file) => file.endsWith('.txt'))
        .map((file) => file.replace('.txt', ''))
        .filter((id) => named.has(id))
        // Percent-encoded: two thirds of Archive filenames contain spaces, and the evidence
        // format spends spaces as separators.
        .map((id) => ({
          locator: `${id}/${encodeURIComponent(named.get(id))}`,
          path: `${dir}/${id}.txt`,
        }))
      return fileDocuments(books, async (path) => readFileSync(path, 'utf8'))
    },
  },
]

export const SOURCES = ALL.filter((source) => {
  if (source.needs === undefined || existsSync(source.needs)) return true
  process.stderr.write(`  (skipping ${source.id}: ${source.needs} is not in .cache/raw)\n`)
  return false
})

/**
 * Slovene publishers, for the harvest.
 *
 * Chosen because they publish in Slovene rather than because they are large. A harvester reads
 * whatever it fetches and has no idea what language it is in, so a domain that publishes mostly
 * in another language would attest that language's words against these candidates.
 */
export const DOMAINS = [
  'rtvslo.si', 'delo.si', 'dnevnik.si', '24ur.com', 'siol.net',
  'mladina.si',
]

export const HARVEST = existsSync(new URL('searched.tsv', import.meta.url).pathname)
  ? () => harvestDocuments(new URL('searched.tsv', import.meta.url).pathname)
  : undefined

/** Carried over from Blinkered's calibration; must be re-measured before anything ships. */
export const COMMON_CUT = 17000
