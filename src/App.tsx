import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownAZ, ArrowUpNarrowWide, Check, Copy, Moon, Search, Shuffle, Sparkles, Sun } from 'lucide-react'
import './App.css'

type Language = 'en' | 'bg'

const seoMetadata: Record<Language, { title: string; description: string; structuredDescription: string; features: string[] }> = {
  en: {
    title: 'Letterwell | Find Words from Your Letters',
    description: 'Find English words from your letters with flexible word filters, random letter racks, and Scrabble, Words With Friends, or Boggle scores.',
    structuredDescription: 'An English word finder that makes words from supplied letters and calculates Scrabble, Words With Friends, and Boggle scores.',
    features: [
      'English word finder',
      'Letter position filters',
      'Random letter racks',
      'Scrabble score calculator',
      'Words With Friends score calculator',
      'Boggle score calculator',
    ],
  },
  bg: {
    title: 'Letterwell | Намери думи от букви',
    description: 'Намери български думи от зададени букви, използвай филтри и разбъркай произволни букви. Провери точките си в Scrabble и Boggle.',
    structuredDescription: 'Българска търсачка за думи, която съставя думи от зададени букви и изчислява точки за Scrabble и Boggle.',
    features: [
      'Българска търсачка за думи',
      'Филтри по позиция на буквите',
      'Случайни комбинации от букви',
      'Калкулатор за точки в български Scrabble',
      'Калкулатор за точки в Boggle',
    ],
  },
}

const examples: Record<Language, string[]> = {
  en: ['triangle', 'listen', 'stream'],
  bg: ['триъгълник', 'слушам', 'поток'],
}
const maxResultsOnPage = 72
const randomLetterPools: Record<Language, string> = {
  en: 'aaaaaaaaabbccddddeeeeeeeeeeeeffggghhiiiiiiiiijjkkllllmmnnnnnnooooooooppqrrrrrrssssttttttuuuuvvwwxxyyz',
  bg: 'аааааааааббввггддддеееееееежззиииииийкккклллммннннннннннооооооооппрррррсссттттттууффхццчшщъьюя',
}
const scrabbleLetterScores: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
}
const bulgarianScrabbleLetterScores: Record<string, number> = {
  а: 1, б: 2, в: 2, г: 3, д: 2, е: 1, ж: 4, з: 4, и: 1, й: 5,
  к: 2, л: 2, м: 2, н: 1, о: 1, п: 1, р: 1, с: 1, т: 1, у: 5,
  ф: 10, х: 5, ц: 8, ч: 5, ш: 8, щ: 10, ъ: 3, ь: 10, ю: 8, я: 5,
}
const wordsWithFriendsLetterScores: Record<string, number> = {
  a: 1, b: 4, c: 4, d: 2, e: 1, f: 4, g: 3, h: 3, i: 1, j: 10, k: 5, l: 2, m: 4,
  n: 2, o: 1, p: 4, q: 10, r: 1, s: 1, t: 1, u: 2, v: 5, w: 4, x: 8, y: 3, z: 10,
}

type SearchHistoryEntry = { letters: string; wordCount: number }

const dictionaryPromises: Partial<Record<Language, Promise<string[]>>> = {}

function getDictionary(language: Language) {
  if (!dictionaryPromises[language]) {
    dictionaryPromises[language] = fetch(`${import.meta.env.BASE_URL}${language === 'bg' ? 'bulgarian-words.txt' : 'english-words.txt'}`)
      .then((response) => {
        if (!response.ok) throw new Error(language === 'bg' ? 'Българският речник не може да бъде зареден.' : 'We could not load the dictionary.')
        return response.text()
      })
      .then((text) => text.split(/\r?\n/).filter((word) => language === 'bg' ? /^[а-я]+$/i.test(word) : /^[a-z]+$/.test(word)))
      .catch((error: unknown) => {
        delete dictionaryPromises[language]
        throw error
      })
  }

  return dictionaryPromises[language] as Promise<string[]>
}

function canBuildWord(word: string, letterCounts: Map<string, number>, requireAll: boolean) {
  if (requireAll && word.length !== [...letterCounts.values()].reduce((sum, count) => sum + count, 0)) {
    return false
  }

  const usedCounts = new Map<string, number>()
  for (const character of word) {
    const usedCount = (usedCounts.get(character) ?? 0) + 1
    usedCounts.set(character, usedCount)
    if (usedCount > (letterCounts.get(character) ?? 0)) return false
  }

  return true
}

function matchesLetterFilters(word: string, startsWith: string, endsWith: string, contains: string) {
  return (
    (!startsWith || word.startsWith(startsWith)) &&
    (!endsWith || word.endsWith(endsWith)) &&
    (!contains || word.includes(contains))
  )
}

function getTileScore(word: string, letterScores: Record<string, number>) {
  return [...word].reduce((score, letter) => score + (letterScores[letter] ?? 0), 0)
}

function getBoggleScore(word: string) {
  if (word.length < 3) return 0
  if (word.length < 5) return 1
  if (word.length === 5) return 2
  if (word.length === 6) return 3
  if (word.length === 7) return 5
  return 11
}

function getRandomLetters(language: Language, count: number) {
  return Array.from(
    { length: count },
    () => randomLetterPools[language][Math.floor(Math.random() * randomLetterPools[language].length)],
  ).join('')
}

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return window.localStorage.getItem('letterwell-language') === 'bg' ? 'bg' : 'en'
    } catch {
      return 'en'
    }
  })
  const [letters, setLetters] = useState('')
  const [minimumLength, setMinimumLength] = useState(2)
  const [maximumLength, setMaximumLength] = useState(12)
  const [randomLetterCount, setRandomLetterCount] = useState(7)
  const [requireAllLetters, setRequireAllLetters] = useState(false)
  const [startsWithLetter, setStartsWithLetter] = useState('')
  const [endsWithLetter, setEndsWithLetter] = useState('')
  const [containsLetter, setContainsLetter] = useState('')
  const [showScrabbleScores, setShowScrabbleScores] = useState(false)
  const [showWordsWithFriendsScores, setShowWordsWithFriendsScores] = useState(false)
  const [showBoggleScores, setShowBoggleScores] = useState(false)
  const [sortOrder, setSortOrder] = useState<'longest' | 'alphabetical'>('longest')
  const [selectedLength, setSelectedLength] = useState<number | 'all'>('all')
  const [words, setWords] = useState<string[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')
  const [copiedWord, setCopiedWord] = useState('')
  const [visibleCount, setVisibleCount] = useState(maxResultsOnPage)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([])
  const text = language === 'bg' ? {
    tagline: 'Търсачка за български думи',
    titleFirst: 'Твоите букви.',
    titleSecond: 'Нови ',
    titleEmphasis: 'възможности.',
    description: 'Разбъркай буквите и открий думите, които се крият в тях.',
    enterLetters: 'ВЪВЕДИ БУКВИТЕ',
    placeholder: 'например триъгълник',
    findWords: 'Намери думи',
    findingWords: 'Търсене…',
    searching: 'Търсене…',
    yourLetters: 'Твоите букви',
    enterUpTo: 'Въведи до 16 букви',
    lettersInPlay: 'БУКВИ В ИГРАТА',
    lettersAppear: 'Твоите букви ще се появят тук',
    randomLetters: 'СЛУЧАЙНИ БУКВИ',
    randomize: 'Разбъркай',
    tryThese: 'ПРОБВАЙ ТЕЗИ',
    recentSearches: 'ПОСЛЕДНИ ТЪРСЕНИЯ',
    clear: 'Изчисти',
    settings: 'Настройки',
    wordLength: 'ДЪЛЖИНА НА ДУМАТА',
    letterPosition: 'ПОЗИЦИЯ НА БУКВАТА',
    startsWith: 'Започва с',
    endsWith: 'Завършва с',
    contains: 'Съдържа',
    any: 'Всяка',
    useAll: 'Използвай всички букви',
    exactAnagrams: 'Намирай точни анаграми',
    scrabbleScores: 'Точки от Scrabble',
    wordsWithFriendsScores: 'Точки от Words With Friends',
    wordsWithFriendsUnavailable: 'Точките от Words With Friends са налични само за английски думи.',
    boggleScores: 'Точки от Boggle',
    foundWords: 'Намерени думи',
    possibleWords: 'Възможните думи ще се появят тук',
    ready: 'Готов ли си за игра?',
    enterFew: 'Въведи няколко букви и възможните думи ще се появят тук.',
    noMatches: 'Няма намерени съвпадения',
    tryDifferent: 'Пробвай друга комбинация или промени дължината.',
    loading: 'Зареждане на българския речник…',
    all: 'Всички',
    moreWords: 'още думи',
    sortResults: 'Сортиране на резултатите',
    sortByLength: 'По дължина',
    sortAlphabetically: 'По азбучен ред',
  } : {
    tagline: 'Your English word finder',
    titleFirst: 'Your letters.',
    titleSecond: 'New ',
    titleEmphasis: 'possibilities.',
    description: 'Mix up your letters and discover the English words hiding inside.',
    enterLetters: 'ENTER YOUR LETTERS',
    placeholder: 'e.g. triangle',
    findWords: 'Find words',
    findingWords: 'Finding words…',
    searching: 'Searching…',
    yourLetters: 'Your letters',
    enterUpTo: 'Enter up to 16 letters',
    lettersInPlay: 'LETTERS IN PLAY',
    lettersAppear: 'Your letters will appear here',
    randomLetters: 'RANDOM LETTERS',
    randomize: 'Randomize',
    tryThese: 'TRY THESE',
    recentSearches: 'RECENT SEARCHES',
    clear: 'Clear',
    settings: 'Settings',
    wordLength: 'WORD LENGTH',
    letterPosition: 'LETTER POSITION',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    contains: 'Contains',
    any: 'Any',
    useAll: 'Use all letters',
    exactAnagrams: 'Find exact anagrams',
    scrabbleScores: 'Scrabble scores',
    wordsWithFriendsScores: 'Words With Friends scores',
    wordsWithFriendsUnavailable: '',
    boggleScores: 'Boggle scores',
    foundWords: 'Found words',
    possibleWords: 'Possible words will appear here',
    ready: 'Ready to play?',
    enterFew: 'Enter a few letters and your possible words will show up here.',
    noMatches: 'No matches found',
    tryDifferent: 'Try a different combination or adjust the word length.',
    loading: 'Loading the English word list for your first search.',
    all: 'All',
    moreWords: 'more words',
    sortResults: 'Sort results',
    sortByLength: 'By length',
    sortAlphabetically: 'A to Z',
  }
  const pageMetadata = seoMetadata[language]

  const normalizedLetters = letters.toLocaleLowerCase(language === 'bg' ? 'bg-BG' : 'en')
  const availableLetters = [...new Set(normalizedLetters)]
  const letterCounts = new Map<string, number>()
  for (const character of normalizedLetters) {
    letterCounts.set(character, (letterCounts.get(character) ?? 0) + 1)
  }

  const effectiveMinimum = requireAllLetters ? normalizedLetters.length : minimumLength
  const effectiveMaximum = requireAllLetters ? normalizedLetters.length : maximumLength
  const [isDark, setIsDark] = useState(() => {
    try {
      return window.localStorage.getItem('letterwell-theme') === 'dark'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    try {
      window.localStorage.setItem('letterwell-theme', isDark ? 'dark' : 'light')
    } catch {
      return
    }
  }, [isDark])

  useEffect(() => {
    try {
      window.localStorage.setItem('letterwell-language', language)
    } catch {
      return
    }
  }, [language])

  useEffect(() => {
    const locale = language === 'bg' ? 'bg_BG' : 'en_US'
    const socialDescription = language === 'bg'
      ? 'Откривай български думи от буквите си и проверявай точките за Scrabble и Boggle.'
      : 'Discover English words from your letters and compare Scrabble, Words With Friends, and Boggle scores.'

    document.documentElement.lang = language
    document.title = pageMetadata.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', pageMetadata.description)
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', locale)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', pageMetadata.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', socialDescription)
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', pageMetadata.title)
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', socialDescription)

    const structuredData = document.querySelector('script[type="application/ld+json"]')
    if (structuredData) {
      structuredData.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Letterwell',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        inLanguage: language,
        description: pageMetadata.structuredDescription,
        featureList: pageMetadata.features,
      })
    }
  }, [language, pageMetadata])

  const sortedWords = [...words].sort((first, second) =>
    sortOrder === 'longest'
      ? second.length - first.length || first.localeCompare(second, language === 'bg' ? 'bg' : 'en')
      : first.localeCompare(second, language === 'bg' ? 'bg' : 'en'),
  )
  const lengthCounts = new Map<number, number>()
  for (const word of words) {
    lengthCounts.set(word.length, (lengthCounts.get(word.length) ?? 0) + 1)
  }
  const lengthOptions = [...lengthCounts.keys()].sort((first, second) => first - second)
  const filteredWords = selectedLength === 'all'
    ? sortedWords
    : sortedWords.filter((word) => word.length === selectedLength)
  const tileScores = language === 'bg' ? bulgarianScrabbleLetterScores : scrabbleLetterScores
  const showAnyWordScores = showScrabbleScores || (language === 'en' && showWordsWithFriendsScores) || showBoggleScores

  function clearResults() {
    setWords([])
    setSelectedLength('all')
    setHasSearched(false)
    setError('')
  }

  function updateLetters(value: string) {
    const letterPattern = language === 'bg' ? /[^а-я]/gi : /[^a-z]/gi
    const nextLetters = value.replace(letterPattern, '').slice(0, 16).toLocaleLowerCase(language === 'bg' ? 'bg-BG' : 'en')
    setLetters(nextLetters)
    setStartsWithLetter((current) => (nextLetters.includes(current) ? current : ''))
    setEndsWithLetter((current) => (nextLetters.includes(current) ? current : ''))
    setContainsLetter((current) => (nextLetters.includes(current) ? current : ''))
    clearResults()
  }

  async function findWords(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!normalizedLetters) return

    setIsSearching(true)
    setError('')
    setHasSearched(false)

    try {
      const dictionary = await getDictionary(language)
      const matches = dictionary.filter(
        (word) =>
          word.length >= effectiveMinimum &&
          word.length <= effectiveMaximum &&
          canBuildWord(word, letterCounts, requireAllLetters) &&
          matchesLetterFilters(word, startsWithLetter, endsWithLetter, containsLetter),
      )
      setWords(matches)
      setSelectedLength('all')
      setVisibleCount(maxResultsOnPage)
      setSearchHistory((previous) => [
        { letters: normalizedLetters, wordCount: matches.length },
        ...previous.filter((entry) => entry.letters !== normalizedLetters),
      ].slice(0, 5))
      setHasSearched(true)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : language === 'bg' ? 'Възникна неочаквана грешка.' : 'Something unexpected happened.')
    } finally {
      setIsSearching(false)
    }
  }

  async function copyWord(word: string) {
    try {
      await navigator.clipboard.writeText(word)
      setCopiedWord(word)
      window.setTimeout(() => setCopiedWord(''), 1400)
    } catch {
      setError(language === 'bg' ? 'Браузърът блокира копирането. Избери думата и я копирай ръчно.' : 'Your browser blocked copying. Select the word and copy it manually.')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Letterwell home">
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.2} /></span>
          <span>letterwell</span>
        </a>
        <div className="topbar-actions">
          <div className="topbar-note"><span className="status-dot" />{text.tagline}</div>
          <label className="language-picker">
            <span className="sr-only">Language</span>
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.target.value as Language)
                setLetters('')
                clearResults()
              }}
              aria-label="Language"
            >
              <option value="en">EN</option>
              <option value="bg">БГ</option>
            </select>
          </label>
          <button
            className="theme-toggle"
            type="button"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setIsDark((current) => !current)}
          >{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </header>

      <main id="top">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <h1 id="page-title">{text.titleFirst}<br />{text.titleSecond}<em>{text.titleEmphasis}</em></h1>
            <p className="intro-description">{text.description}</p>
          </div>
          <div className="letter-art" aria-label="The word CREATE arranged with colorful letter tiles">
            <span className="art-caption">A FEW LETTERS, MANY WORDS</span>
            <div className="art-tiles" aria-hidden="true">
              <span className="art-tile tile-coral">C</span>
              <span className="art-tile tile-yellow">R</span>
              <span className="art-tile tile-blue">E</span>
              <span className="art-tile tile-white">A</span>
              <span className="art-tile tile-mint">T</span>
              <span className="art-tile tile-white">E</span>
            </div>
            <span className="art-footnote">C R E A T E <span>→</span> CREATE</span>
          </div>
          <form className="hero-entry" onSubmit={findWords}>
            <label className="field-label" htmlFor="hero-letters-input">{text.enterLetters}</label>
            <input
              id="hero-letters-input"
              className="letters-input"
              autoComplete="off"
              autoCapitalize="none"
              maxLength={16}
              placeholder={text.placeholder}
              value={letters}
              onChange={(event) => updateLetters(event.target.value)}
            />
            <button className="hero-search-button" type="submit" disabled={!normalizedLetters || isSearching}>
              {isSearching ? text.findingWords : text.findWords}
            </button>
          </form>
          
        </section>

        <section className="workspace" aria-label="English word finder">
          <form className="controls" onSubmit={findWords}>
            <div className="control-heading">
              <span className="step-number">01</span>
              <div>
                <h2>{text.yourLetters}</h2>
                <p>{text.enterUpTo}</p>
              </div>
            </div>

            <div className="letter-preview" aria-live="polite">
              {normalizedLetters ? (
                <>
                  <span className="preview-label">{text.lettersInPlay}</span>
                  <div className="preview-tiles">
                    {normalizedLetters.split('').map((letter, index) => (
                      <span className="preview-tile" key={`${letter}-${index}`}>{letter.toUpperCase()}</span>
                    ))}
                  </div>
                </>
              ) : (
                <span className="preview-hint">{text.lettersAppear}</span>
              )}
            </div>

            <div className="random-letter-picker">
              <label>
                <span>{text.randomLetters}</span>
                <select
                  aria-label="Number of random letters"
                  value={randomLetterCount}
                  onChange={(event) => setRandomLetterCount(Number(event.target.value))}
                >
                  {Array.from({ length: 15 }, (_, index) => index + 2).map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => updateLetters(getRandomLetters(language, randomLetterCount))}>
                <Shuffle size={15} />{text.randomize}
              </button>
            </div>

            <div className="examples">
              <span>{text.tryThese}</span>
              {examples[language].map((example) => (
                <button
                  className="example-button"
                  type="button"
                  key={example}
                  onClick={() => {
                    updateLetters(example)
                  }}
                >
                  {example}
                </button>
              ))}
            </div>

            {searchHistory.length > 0 && (
              <div className="search-history">
                <div className="history-heading">
                  <span>{text.recentSearches}</span>
                  <button type="button" onClick={() => setSearchHistory([])}>{text.clear}</button>
                </div>
                <div className="history-list" role="group" aria-label="Recent searches">
                  {searchHistory.map((entry) => (
                    <button
                      className="history-button"
                      type="button"
                      key={entry.letters}
                      aria-label={`Use previous search ${entry.letters}, ${entry.wordCount} words`}
                      onClick={() => {
                        updateLetters(entry.letters)
                      }}
                    >
                      <span>{entry.letters}</span>
                      <small>{entry.wordCount}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="settings-divider" />
            <div className="settings-title"><span className="step-number">02</span><h2>{text.settings}</h2></div>

            <fieldset className="length-settings" disabled={requireAllLetters}>
              <legend>{text.wordLength}</legend>
              <label className="number-control">
                <span>Min</span>
                <input
                  aria-label="Minimum word length"
                  type="number"
                  min={2}
                  max={16}
                  value={minimumLength}
                  onChange={(event) => {
                    setMinimumLength(Math.min(Number(event.target.value) || 2, maximumLength))
                    clearResults()
                  }}
                />
                <span>{language === 'bg' ? 'букви' : 'letters'}</span>
              </label>
              <span className="range-dash">—</span>
              <label className="number-control">
                <span>Max</span>
                <input
                  aria-label="Maximum word length"
                  type="number"
                  min={2}
                  max={16}
                  value={maximumLength}
                  onChange={(event) => {
                    setMaximumLength(Math.max(Number(event.target.value) || 2, minimumLength))
                    clearResults()
                  }}
                />
                <span>{language === 'bg' ? 'букви' : 'letters'}</span>
              </label>
            </fieldset>

            <fieldset className="letter-match-settings">
              <legend>{text.letterPosition}</legend>
              <div className="letter-filter-controls">
                {([
                  [text.startsWith, startsWithLetter, setStartsWithLetter],
                  [text.endsWith, endsWithLetter, setEndsWithLetter],
                  [text.contains, containsLetter, setContainsLetter],
                ] as const).map(([label, value, setValue]) => (
                  <label className="letter-select-control" key={label}>
                    <span>{label}</span>
                    <select
                      aria-label={`${label} letter`}
                      value={value}
                      disabled={availableLetters.length === 0}
                      onChange={(event) => {
                        setValue(event.target.value)
                        clearResults()
                      }}
                    >
                      <option value="">{text.any}</option>
                      {availableLetters.map((letter) => (
                        <option key={letter} value={letter}>{letter.toUpperCase()}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={requireAllLetters}
                onChange={(event) => {
                  setRequireAllLetters(event.target.checked)
                  clearResults()
                }}
              />
              <span className="custom-check"><Check size={14} /></span>
              <span className="toggle-copy"><strong>{text.useAll}</strong><small>{text.exactAnagrams}</small></span>
            </label>

            <button className="search-button" type="submit" disabled={!normalizedLetters || isSearching}>
              {isSearching ? <span className="spinner" /> : <Search size={18} />}
              {isSearching ? text.searching : text.findWords}
            </button>
            <p className="dictionary-note">{language === 'bg' ? 'Търсенето използва локален български речник.' : 'Search runs locally using an English word list.'}</p>
          </form>

          <section className="results" aria-live="polite" aria-busy={isSearching}>
            <div className="results-header">
              <div className="control-heading results-heading">
                <span className="step-number">03</span>
                <div>
                  <h2>{text.foundWords}</h2>
                  <p>{hasSearched ? `${words.length} ${language === 'bg' ? 'думи' : words.length === 1 ? 'word' : 'words'} ${language === 'bg' ? 'от твоите букви' : 'from your letters'}` : text.possibleWords}</p>
                </div>
              </div>
              <div className="results-actions">
                <label className="setting-toggle scores-toggle">
                  <input
                    type="checkbox"
                    checked={showScrabbleScores}
                    onChange={(event) => setShowScrabbleScores(event.target.checked)}
                  />
                  <span className="custom-check"><Check size={14} /></span>
                  <span className="toggle-copy"><strong>{text.scrabbleScores}</strong></span>
                </label>
                {language === 'en' ? (
                  <label className="setting-toggle scores-toggle">
                    <input
                      type="checkbox"
                      checked={showWordsWithFriendsScores}
                      onChange={(event) => setShowWordsWithFriendsScores(event.target.checked)}
                    />
                    <span className="custom-check"><Check size={14} /></span>
                    <span className="toggle-copy"><strong>{text.wordsWithFriendsScores}</strong></span>
                  </label>
                ) : (
                  <span className="score-note">{text.wordsWithFriendsUnavailable}</span>
                )}
                <label className="setting-toggle scores-toggle">
                  <input
                    type="checkbox"
                    checked={showBoggleScores}
                    onChange={(event) => setShowBoggleScores(event.target.checked)}
                  />
                  <span className="custom-check"><Check size={14} /></span>
                  <span className="toggle-copy"><strong>{text.boggleScores}</strong></span>
                </label>
                {hasSearched && words.length > 0 && (
                  <div className="sort-control" aria-label={text.sortResults}>
                    <button
                      type="button"
                      aria-pressed={sortOrder === 'longest'}
                      aria-label={text.sortByLength}
                      title={text.sortByLength}
                      onClick={() => setSortOrder('longest')}
                    ><ArrowUpNarrowWide size={17} /></button>
                    <button
                      type="button"
                      aria-pressed={sortOrder === 'alphabetical'}
                      aria-label={text.sortAlphabetically}
                      title={text.sortAlphabetically}
                      onClick={() => setSortOrder('alphabetical')}
                    ><ArrowDownAZ size={17} /></button>
                  </div>
                )}
                </div>
            </div>

            {error ? (
              <div className="empty-state error-state"><span className="empty-spark">!</span><h3>{language === 'bg' ? 'Нещо се обърка' : 'Something went wrong'}</h3><p>{error}</p></div>
            ) : isSearching ? (
              <div className="empty-state"><span className="loading-orbit"><span /></span><h3>{language === 'bg' ? 'Разбъркваме буквите…' : 'Mixing things up…'}</h3><p>{text.loading}</p></div>
            ) : !hasSearched ? (
              <div className="empty-state"><span className="empty-spark"><Sparkles size={22} /></span><h3>{text.ready}</h3><p>{text.enterFew}</p></div>
            ) : words.length === 0 ? (
              <div className="empty-state"><span className="empty-spark">↗</span><h3>{text.noMatches}</h3><p>{text.tryDifferent}</p></div>
            ) : (
              <>
                <div className="length-filters" role="group" aria-label="Filter by word length">
                  <button
                    className="length-filter-button"
                    type="button"
                    aria-pressed={selectedLength === 'all'}
                    onClick={() => {
                      setSelectedLength('all')
                      setVisibleCount(maxResultsOnPage)
                    }}
                  ><span>{text.all}</span><small>{words.length}</small></button>
                  {lengthOptions.map((length) => (
                    <button
                      className="length-filter-button"
                      type="button"
                      key={length}
                      aria-pressed={selectedLength === length}
                      aria-label={`${length} letters, ${lengthCounts.get(length)} words`}
                      onClick={() => {
                        setSelectedLength(length)
                        setVisibleCount(maxResultsOnPage)
                      }}
                    ><span>{length} {language === 'bg' ? 'букви' : 'letters'}</span><small>{lengthCounts.get(length)}</small></button>
                  ))}
                </div>
                <div className="result-meta"><span>{language === 'bg' ? 'ДУМИ, КОИТО МОЖЕШ ДА НАПРАВИШ' : 'WORDS YOU CAN MAKE'}</span><span>{Math.min(filteredWords.length, visibleCount)} / {filteredWords.length}</span></div>
                <div
                  className="word-list"
                  style={{ '--result-rows': Math.ceil(Math.min(filteredWords.length, visibleCount) / 2) } as React.CSSProperties}
                >
                  {filteredWords.slice(0, visibleCount).map((word, index) => (
                    <div className="word-row" key={word} style={{ '--row-index': index } as React.CSSProperties}>
                      <span className="word-index">{index + 1}</span>
                      <span className="word-text">{word}</span>
                      {showAnyWordScores && (
                        <div className="word-scores">
                          {showScrabbleScores && (
                            <span className="score-badge" aria-label={`Scrabble score ${getTileScore(word, tileScores)}`}>
                              SCR {getTileScore(word, tileScores)}
                            </span>
                          )}
                          {language === 'en' && showWordsWithFriendsScores && (
                            <span className="score-badge" aria-label={`Words With Friends score ${getTileScore(word, wordsWithFriendsLetterScores)}`}>
                              WWF {getTileScore(word, wordsWithFriendsLetterScores)}
                            </span>
                          )}
                          {showBoggleScores && (
                            <span className="score-badge" aria-label={`Boggle score ${getBoggleScore(word)}`}>
                              BOG {getBoggleScore(word)}
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        className="copy-button"
                        type="button"
                        aria-label={`Copy ${word}`}
                        title={`Copy ${word}`}
                        onClick={() => void copyWord(word)}
                      >{copiedWord === word ? <Check size={16} /> : <Copy size={15} />}</button>
                    </div>
                  ))}
                </div>
                {filteredWords.length > visibleCount && (
                  <button className="show-more-button" type="button" onClick={() => setVisibleCount((count) => count + maxResultsOnPage)}>
                    {language === 'bg' ? 'Покажи' : 'Show'} {Math.min(maxResultsOnPage, filteredWords.length - visibleCount)} {language === 'bg' ? 'още думи' : 'more words'}
                  </button>
                )}
              </>
            )}
          </section>
        </section>
      </main>

      <footer className="footer"><span>letterwell</span><span>Every word starts somewhere.</span></footer>
    </div>
  )
}

export default App
