export type Language = 'en' | 'kn'

export interface Messages {
  header: {
    wordmark: string
    menu: string
    browseDemoData: string
    backToSearch: string
    about: string
    switchLanguage: string
    siteNavigation: string
  }
  progress: {
    label: string
    collection: string
    personDetails: string
    possibleMatches: string
    verifySource: string
    mobileSummary: string
  }
  collection: {
    heading: string
    subheading: string
  }
  prototype: {
    boundary: string
    independentPrototype: string
    syntheticDataOnly: string
    doNotEnterPersonalInformation: string
  }
  demo: {
    heading: string
    warning: string
    loading: string
    error: string
    retry: string
    filterLabel: string
    filterHelper: string
    noResults: string
    showing: string
    page: string
    previousPage: string
    nextPage: string
    useSample: string
    syntheticId: string
    nativeName: string
    latinName: string
    nativeRelativeName: string
    latinRelativeName: string
    nativeLocality: string
    latinLocality: string
    age: string
    sourcePart: string
    sourcePage: string
  }
  person: {
    name: string
    namePlaceholder: string
    nameHelper: string
    addMoreDetails: string
    hideExtraDetails: string
    relativeName: string
    relativeHelper: string
    locality: string
    localityHelper: string
    ageInRollYear: string
    ageHelper: string
    optional: string
    submit: string
    submitting: string
  }
  examples: {
    heading: string
    fictionalMarker: string
    useExample: string
    exactKannada: { title: string; description: string }
    romanizedTypo: { title: string; description: string }
    needsRefinement: { title: string; description: string }
    noConfidentMatch: { title: string; description: string }
  }
  results: {
    heading: string
    oneMatch: string
    manyMatches: string
    needsMoreDetail: string
    editSearch: string
    noConfidentResult: string
    changeSearch: string
    limitedSearch: string
    previous: string
    nextResult: string
    verifySource: string
    whatMatched: string
    ageInRollYear: string
    caution: string
    resultPosition: string
    previousResult: string
    selectedResult: string
    fieldName: string
    fieldRelativeName: string
    fieldLocality: string
    fieldAge: string
    noSave: string
  }
  evidence: {
    heading: string
    cropLabel: string
    openLarger: string
    close: string
    part: string
    page: string
    loading: string
    error: string
    caution: string
    howSearchWorked: string
    howSearchDetail: string
    name: string
    relativeName: string
    locality: string
    ageInRollYear: string
  }
  about: {
    title: string
    whyTitle: string
    whyText: string
    privacyTitle: string
    privacyText: string
    privacyAccessModels: string
    prototypeTitle: string
    prototypeText: string
    containsTitle: string
    containsText: string
    informedTitle: string
    informedText: string
    futureTitle: string
    currentScope: string
    publicNavigationTitle: string
    publicNavigationText: string
    authorizedRetrievalTitle: string
    authorizedRetrievalText: string
    futureExamples: string
    futureRules: string
    officialContext: string
  }
  search: {
    summaryRegionLabel: string
    summaryHeading: string
    summaryName: string
    summaryRelative: string
    summaryLocality: string
    summaryAge: string
    resultsRegionLabel: string
    reset: string
    unavailable: string
  }
  blankGuide: {
    heading: string
    enterName: string
    addDetails: string
    compareMatches: string
    privacy: string
  }
  safety: {
    notice: string
  }
  matchLabels: {
    exact: string
    close: string
    related: string
  }
}

export const messages: Record<Language, Messages> = {
  en: {
    header: {
      wordmark: 'India Public Record Finder',
      menu: 'Menu',
      browseDemoData: 'Browse fictional demo data',
      backToSearch: 'Back to search',
      about: 'About',
      switchLanguage: 'Switch to Kannada',
      siteNavigation: 'Site navigation',
    },
    progress: {
      label: 'Search progress',
      collection: 'Collection',
      personDetails: 'Person details',
      possibleMatches: 'Possible matches',
      verifySource: 'Verify source',
      mobileSummary: 'Step {current} of 4 - {step}',
    },
    collection: {
      heading: 'Find a record. Verify the source.',
      subheading: 'Karnataka - Synthetic historical roll',
    },
    prototype: {
      boundary: 'Synthetic data only',
      independentPrototype: 'Independent hackathon prototype',
      syntheticDataOnly: 'Synthetic data only',
      doNotEnterPersonalInformation: 'Do not enter real personal information.',
    },
    demo: {
      heading: 'Synthetic demo records',
      warning: 'Judge-only test bench. Every record is fictional. A production service containing real records must not offer browse-all access.',
      loading: 'Loading fictional records',
      error: 'Fictional records could not be loaded. Try again.',
      retry: 'Try again',
      filterLabel: 'Filter fictional records',
      filterHelper: 'Search by ID, name, relative, locality, part, or page',
      noResults: 'No fictional records match this filter.',
      showing: 'Showing {start}-{end} of {total} records',
      page: 'Page {current} of {total}',
      previousPage: 'Previous page',
      nextPage: 'Next page',
      useSample: 'Use this sample: {id}',
      syntheticId: 'Synthetic ID',
      nativeName: 'Name',
      latinName: 'Latin name',
      nativeRelativeName: 'Relative name',
      latinRelativeName: 'Latin relative name',
      nativeLocality: 'Locality',
      latinLocality: 'Latin locality',
      age: 'Age',
      sourcePart: 'Source part',
      sourcePage: 'Source page',
    },
    person: {
      name: 'Name',
      namePlaceholder: 'Example: ಅನನ್ಯಾ ಗೌಡ',
      nameHelper: 'Kannada or English letters are accepted.',
      addMoreDetails: 'Add more details',
      hideExtraDetails: 'Hide extra details',
      relativeName: "Relative's name",
      relativeHelper: 'Parent, spouse, guardian, or another relative as shown in the roll',
      locality: 'Locality',
      localityHelper: 'Village, ward, or neighbourhood',
      ageInRollYear: 'Age in roll year',
      ageHelper: 'Enter an estimate if the exact age is unknown.',
      optional: 'optional',
      submit: 'Find possible matches',
      submitting: 'Finding possible matches',
    },
    examples: {
      heading: 'Try a fictional example',
      fictionalMarker: 'Fictional example',
      useExample: 'Use example: {scenario}',
      exactKannada: { title: 'Exact Kannada', description: 'A name entered in Kannada finds the matching fictional record.' },
      romanizedTypo: { title: 'Romanized spelling variation', description: 'A small spelling variation in English letters can still find a possible match.' },
      needsRefinement: { title: 'Needs refinement', description: 'Add a relative, locality, or age to narrow the results.' },
      noConfidentMatch: { title: 'No confident match', description: 'The demo safely shows when it cannot find a confident result.' },
    },
    results: {
      heading: 'Possible matches', oneMatch: '{count} possible match', manyMatches: '{count} possible matches', needsMoreDetail: 'Needs more detail', editSearch: 'Edit search',
      noConfidentResult: 'We could not find a confident result.', changeSearch: "Try changing the name, locality, or relative's name.",
      limitedSearch: 'Search is temporarily limited. Results may be incomplete.', previous: 'Previous', nextResult: 'Next result', verifySource: 'Verify source',
      whatMatched: 'What matched your entry', ageInRollYear: 'Age in roll year: {age}', caution: 'Possible match - not an official result',
      resultPosition: 'Result {current} of {total}', previousResult: 'Previous result', selectedResult: 'Selected possible match',
      fieldName: 'Name', fieldRelativeName: "Relative's name", fieldLocality: 'Locality',
      fieldAge: 'Age',
      noSave: 'Your entries were not saved.',
    },
    evidence: {
      heading: 'Check the source before deciding', cropLabel: 'Synthetic source crop', openLarger: 'Open larger view', close: 'Close', part: 'Part {sourcePart}', page: 'Page {sourcePage}',
      loading: 'Loading source evidence', error: 'Source evidence could not be displayed. Check the displayed fields and source reference before deciding.',
      caution: 'Possible match - not an official result', howSearchWorked: 'How search worked', howSearchDetail: 'Pre-indexed multilingual retrieval surfaced possible candidates. Check each displayed field and the source before deciding.',
      name: 'Name', relativeName: "Relative's name", locality: 'Locality', ageInRollYear: 'Age in roll year',
    },
    about: {
      title: 'About this demo', whyTitle: 'Why this exists', whyText: 'Scanned historical rolls are difficult to navigate when language, spelling, relatives, and geography vary.',
      privacyTitle: 'The privacy tradeoff', privacyText: 'Karnataka CEO archival roll PDFs use structured paths identifying district, assembly constituency, and part. Structured paths can lower automation and correlation barriers. This observation is not an allegation of illegality. This independent prototype explores a purpose-limited alternative without reproducing a browse-all real-person directory.', privacyAccessModels: 'Individual public inspection and machine-scale discoverability are different access models.',
      prototypeTitle: 'What this prototype does', prototypeText: 'It guides one specific search, surfaces possible matches, and asks a person to check source evidence.',
      containsTitle: 'What this demo contains', containsText: '120 fictional Karnataka records, synthetic PDFs, and synthetic source crops only.',
      informedTitle: 'How it was informed', informedText: 'The interaction design was informed by private family research; no family data or real electoral-roll record is included in this demo.',
      futureTitle: 'Where this can go', currentScope: 'Only the synthetic Karnataka SIR profile works today.', publicNavigationTitle: 'Public-source navigation', publicNavigationText: 'Future public-source navigation can help people reach cited official records without creating a browse-all mirror.', authorizedRetrievalTitle: 'Citizen-authorized and authority-managed retrieval', authorizedRetrievalText: 'Personal or restricted records stay within the responsible authority\'s own access, consent, and delivery process. Where required, login, CAPTCHA, OTP, eKYC, payment, or a supplied reference remains with that authority.', futureExamples: 'Future examples include mixed public-metadata and authority-managed land/property workflows; reference-led court case and order navigation with safeguards; gazettes and orders, RERA, environmental approvals, certificates, benefits, municipal records, and archives.', futureRules: 'Every future source needs its own access, privacy, language, accuracy, and provenance rules.', officialContext: 'Karnataka CEO website (context only)',
    },
    search: {
      summaryRegionLabel: 'Your search',
      summaryHeading: 'Your search',
      summaryName: 'Name',
      summaryRelative: 'Relative',
      summaryLocality: 'Locality',
      summaryAge: 'Age',
      resultsRegionLabel: 'Search results',
      reset: 'Reset',
      unavailable: 'Search is unavailable. Try again. Your entries were not saved.',
    },
    blankGuide: {
      heading: 'How this demo works',
      enterName: 'Enter a name in Kannada or English.',
      addDetails: 'Add a family, locality, or roll-year detail if known.',
      compareMatches: 'Compare possible matches and verify the fictional source.',
      privacy: 'This demo does not save entries or send your search to an LLM provider.',
    },
    safety: {
      notice: 'Demo only. Every record is fictional. Do not enter real personal information. Entries are not saved.',
    },
    matchLabels: {
      exact: 'Exact match',
      close: 'Close match',
      related: 'Related match',
    },
  },
  kn: {
    header: {
      wordmark: 'India Public Record Finder',
      menu: 'ಮೆನು',
      browseDemoData: 'ಕಾಲ್ಪನಿಕ ಡೆಮೊ ಮಾಹಿತಿಯನ್ನು ವೀಕ್ಷಿಸಿ',
      backToSearch: 'ಹುಡುಕಾಟಕ್ಕೆ ಹಿಂತಿರುಗಿ',
      about: 'ಇದರ ಬಗ್ಗೆ',
      switchLanguage: 'ಇಂಗ್ಲಿಷ್‌ಗೆ ಬದಲಿಸಿ',
      siteNavigation: 'ತಾಣದ ಸಂಚರಣೆ',
    },
    progress: {
      label: 'ಹುಡುಕಾಟದ ಹಂತಗಳು',
      collection: 'ದಾಖಲೆ ಸಂಗ್ರಹ',
      personDetails: 'ವ್ಯಕ್ತಿಯ ವಿವರಗಳು',
      possibleMatches: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳು',
      verifySource: 'ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ',
      mobileSummary: 'ಹಂತ {current} / 4 - {step}',
    },
    collection: {
      heading: 'ದಾಖಲೆ ಹುಡುಕಿ. ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.',
      subheading: 'ಕರ್ನಾಟಕ - ಕೃತಕ ಐತಿಹಾಸಿಕ ಮತದಾರರ ಪಟ್ಟಿ',
    },
    prototype: {
      boundary: 'ಕೃತಕ ಮಾಹಿತಿ ಮಾತ್ರ',
      independentPrototype: 'ಸ್ವತಂತ್ರ ಹ್ಯಾಕಥಾನ್ ಮಾದರಿ',
      syntheticDataOnly: 'ಕೃತಕ ಮಾಹಿತಿ ಮಾತ್ರ',
      doNotEnterPersonalInformation: 'ನಿಜವಾದ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ನಮೂದಿಸಬೇಡಿ.',
    },
    demo: {
      heading: 'ಕೃತಕ ಡೆಮೊ ದಾಖಲೆಗಳು',
      warning: 'ತೀರ್ಪುಗಾರರ ಪರೀಕ್ಷೆಗೆ ಮಾತ್ರ. ಪ್ರತಿಯೊಂದು ದಾಖಲೆ ಕಾಲ್ಪನಿಕ. ನಿಜವಾದ ವ್ಯಕ್ತಿಗಳ ದಾಖಲೆಗಳನ್ನು ಒಳಗೊಂಡ ಉತ್ಪಾದನಾ ಸೇವೆಯಲ್ಲಿ ಎಲ್ಲ ದಾಖಲೆಗಳನ್ನು ಒಟ್ಟಾಗಿ ವೀಕ್ಷಿಸುವ ಅವಕಾಶ ಇರಬಾರದು.',
      loading: 'ಕಾಲ್ಪನಿಕ ದಾಖಲೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ',
      error: 'ಕಾಲ್ಪನಿಕ ದಾಖಲೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      retry: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
      filterLabel: 'ಕಾಲ್ಪನಿಕ ದಾಖಲೆಗಳನ್ನು ಶೋಧಿಸಿ',
      filterHelper: 'ID, ಹೆಸರು, ಸಂಬಂಧಿ, ಊರು, ಭಾಗ ಅಥವಾ ಪುಟದ ಮೂಲಕ ಶೋಧಿಸಿ',
      noResults: 'ಈ ಶೋಧನೆಗೆ ಹೊಂದುವ ಕಾಲ್ಪನಿಕ ದಾಖಲೆಗಳಿಲ್ಲ.',
      showing: '{total} ದಾಖಲೆಗಳಲ್ಲಿ {start}-{end} ತೋರಿಸಲಾಗುತ್ತಿದೆ',
      page: 'ಪುಟ {current} / {total}',
      previousPage: 'ಹಿಂದಿನ ಪುಟ',
      nextPage: 'ಮುಂದಿನ ಪುಟ',
      useSample: 'ಈ ಮಾದರಿಯನ್ನು ಬಳಸಿ: {id}',
      syntheticId: 'ಕೃತಕ ID',
      nativeName: 'ಹೆಸರು',
      latinName: 'ಇಂಗ್ಲಿಷ್ ಹೆಸರು',
      nativeRelativeName: 'ಸಂಬಂಧಿಯ ಹೆಸರು',
      latinRelativeName: 'ಇಂಗ್ಲಿಷ್ ಸಂಬಂಧಿಯ ಹೆಸರು',
      nativeLocality: 'ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ',
      latinLocality: 'ಇಂಗ್ಲಿಷ್ ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ',
      age: 'ವಯಸ್ಸು',
      sourcePart: 'ಮೂಲದ ಭಾಗ',
      sourcePage: 'ಮೂಲದ ಪುಟ',
    },
    person: {
      name: 'ಹೆಸರು',
      namePlaceholder: 'ಉದಾಹರಣೆ: ಅನನ್ಯಾ ಗೌಡ',
      nameHelper: 'ಕನ್ನಡ ಅಥವಾ ಇಂಗ್ಲಿಷ್ ಅಕ್ಷರಗಳನ್ನು ಬಳಸಬಹುದು.',
      addMoreDetails: 'ಹೆಚ್ಚಿನ ವಿವರಗಳನ್ನು ಸೇರಿಸಿ',
      hideExtraDetails: 'ಹೆಚ್ಚುವರಿ ವಿವರಗಳನ್ನು ಮರೆಮಾಡಿ',
      relativeName: 'ಸಂಬಂಧಿಯ ಹೆಸರು',
      relativeHelper: 'ಮತದಾರರ ಪಟ್ಟಿಯಲ್ಲಿ ಇರುವಂತೆ ತಂದೆ, ತಾಯಿ, ಪತಿ, ಪತ್ನಿ, ಪಾಲಕರು ಅಥವಾ ಬೇರೆ ಸಂಬಂಧಿಯ ಹೆಸರು',
      locality: 'ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ',
      localityHelper: 'ಗ್ರಾಮ, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ',
      ageInRollYear: 'ಮತದಾರರ ಪಟ್ಟಿಯ ವರ್ಷದ ವಯಸ್ಸು',
      ageHelper: 'ನಿಖರ ವಯಸ್ಸು ತಿಳಿಯದಿದ್ದರೆ ಅಂದಾಜು ವಯಸ್ಸನ್ನು ನಮೂದಿಸಿ.',
      optional: 'ಐಚ್ಛಿಕ',
      submit: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಹುಡುಕಿ',
      submitting: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ',
    },
    examples: {
      heading: 'ಕಾಲ್ಪನಿಕ ಉದಾಹರಣೆಯನ್ನು ಪ್ರಯತ್ನಿಸಿ',
      fictionalMarker: 'ಕಾಲ್ಪನಿಕ ಉದಾಹರಣೆ',
      useExample: 'ಈ ಉದಾಹರಣೆಯನ್ನು ಬಳಸಿ: {scenario}',
      exactKannada: { title: 'ಕನ್ನಡದಲ್ಲಿ ನಿಖರ ಹೊಂದಾಣಿಕೆ', description: 'ಕನ್ನಡದಲ್ಲಿ ನಮೂದಿಸಿದ ಹೆಸರು ಹೊಂದುವ ಕಾಲ್ಪನಿಕ ದಾಖಲೆಯನ್ನು ಕಂಡುಕೊಳ್ಳುತ್ತದೆ.' },
      romanizedTypo: { title: 'ಇಂಗ್ಲಿಷ್ ಅಕ್ಷರಗಳಲ್ಲಿ ಬರೆಯುವಾಗ ಇರುವ ಸಣ್ಣ ವ್ಯತ್ಯಾಸ', description: 'ಇಂಗ್ಲಿಷ್ ಅಕ್ಷರಗಳಲ್ಲಿ ಸಣ್ಣ ಕಾಗುಣಿತ ವ್ಯತ್ಯಾಸ ಇದ್ದರೂ ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆ ಸಿಗಬಹುದು.' },
      needsRefinement: { title: 'ಇನ್ನಷ್ಟು ವಿವರ ಬೇಕಿದೆ', description: 'ಫಲಿತಾಂಶವನ್ನು ಕಿರಿದಾಗಿಸಲು ಸಂಬಂಧಿಯ ಹೆಸರು, ಊರು ಅಥವಾ ವಯಸ್ಸನ್ನು ಸೇರಿಸಿ.' },
      noConfidentMatch: { title: 'ಖಚಿತ ಹೊಂದಾಣಿಕೆ ಇಲ್ಲ', description: 'ಖಚಿತ ಫಲಿತಾಂಶ ಸಿಗದಾಗ ಡೆಮೊ ಅದನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ತೋರಿಸುತ್ತದೆ.' },
    },
    results: {
      heading: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳು', oneMatch: '{count} ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆ', manyMatches: '{count} ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳು', needsMoreDetail: 'ಇನ್ನಷ್ಟು ವಿವರ ಬೇಕಿದೆ', editSearch: 'ಹುಡುಕಾಟವನ್ನು ತಿದ್ದು',
      noConfidentResult: 'ಖಚಿತ ಫಲಿತಾಂಶವನ್ನು ಕಂಡುಹಿಡಿಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.', changeSearch: 'ಹೆಸರು, ಊರು ಅಥವಾ ಸಂಬಂಧಿಯ ಹೆಸರನ್ನು ಬದಲಿಸಿ ಪ್ರಯತ್ನಿಸಿ.',
      limitedSearch: 'ಹುಡುಕಾಟ ಸೇವೆ ತಾತ್ಕಾಲಿಕವಾಗಿ ಸೀಮಿತವಾಗಿದೆ. ಫಲಿತಾಂಶಗಳು ಪೂರ್ಣವಾಗಿಲ್ಲದಿರಬಹುದು.', previous: 'ಹಿಂದಿನದು', nextResult: 'ಮುಂದಿನ ಫಲಿತಾಂಶ', verifySource: 'ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ',
      whatMatched: 'ನಿಮ್ಮ ನಮೂದಿನೊಂದಿಗೆ ಹೊಂದಿದವು', ageInRollYear: 'ಮತದಾರರ ಪಟ್ಟಿಯ ವರ್ಷದ ವಯಸ್ಸು: {age}', caution: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆ - ಅಧಿಕೃತ ಫಲಿತಾಂಶವಲ್ಲ',
      resultPosition: 'ಫಲಿತಾಂಶ {current} / {total}', previousResult: 'ಹಿಂದಿನ ಫಲಿತಾಂಶ', selectedResult: 'ಆಯ್ಕೆ ಮಾಡಿದ ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆ',
      fieldName: 'ಹೆಸರು', fieldRelativeName: 'ಸಂಬಂಧಿಯ ಹೆಸರು', fieldLocality: 'ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ',
      fieldAge: 'ವಯಸ್ಸು',
      noSave: 'ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ಉಳಿಸಲಾಗಿಲ್ಲ.',
    },
    evidence: {
      heading: 'ತೀರ್ಮಾನಕ್ಕೆ ಬರುವ ಮೊದಲು ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ', cropLabel: 'ಕೃತಕ ಮೂಲದ ಭಾಗದ ಚಿತ್ರ', openLarger: 'ದೊಡ್ಡದಾಗಿ ನೋಡಿ', close: 'ಮುಚ್ಚಿ', part: 'ಭಾಗ {sourcePart}', page: 'ಪುಟ {sourcePage}',
      loading: 'ಮೂಲದ ಸಾಕ್ಷ್ಯ ಲೋಡ್ ಆಗುತ್ತಿದೆ', error: 'ಮೂಲದ ಸಾಕ್ಷ್ಯವನ್ನು ತೋರಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ತೀರ್ಮಾನಕ್ಕೆ ಬರುವ ಮೊದಲು ತೋರಿಸಿರುವ ವಿವರಗಳು ಮತ್ತು ಮೂಲದ ಉಲ್ಲೇಖವನ್ನು ಪರಿಶೀಲಿಸಿ.',
      caution: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆ - ಅಧಿಕೃತ ಫಲಿತಾಂಶವಲ್ಲ', howSearchWorked: 'ಹುಡುಕಾಟ ಹೇಗೆ ಕೆಲಸ ಮಾಡಿತು', howSearchDetail: 'ಮೊದಲೇ ಸೂಚ್ಯಂಕಗೊಳಿಸಿದ ಬಹುಭಾಷಾ ಹುಡುಕಾಟವು ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ತೋರಿಸಿದೆ. ತೀರ್ಮಾನಕ್ಕೆ ಬರುವ ಮೊದಲು ತೋರಿಸಿರುವ ಪ್ರತಿಯೊಂದು ವಿವರ ಮತ್ತು ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.',
      name: 'ಹೆಸರು', relativeName: 'ಸಂಬಂಧಿಯ ಹೆಸರು', locality: 'ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ', ageInRollYear: 'ಮತದಾರರ ಪಟ್ಟಿಯ ವರ್ಷದ ವಯಸ್ಸು',
    },
    about: {
      title: 'ಈ ಡೆಮೊ ಕುರಿತು', whyTitle: 'ಇದು ಏಕೆ ಬೇಕಾಗಿದೆ', whyText: 'ಭಾಷೆ, ಕಾಗುಣಿತ, ಸಂಬಂಧಿಗಳು ಮತ್ತು ಸ್ಥಳದ ವಿವರಗಳು ಬದಲಾಗುವಾಗ ಸ್ಕ್ಯಾನ್ ಮಾಡಿದ ಐತಿಹಾಸಿಕ ಮತದಾರರ ಪಟ್ಟಿಗಳಲ್ಲಿ ಹುಡುಕುವುದು ಕಷ್ಟವಾಗಬಹುದು.',
      privacyTitle: 'ಗೌಪ್ಯತೆಯ ವಿಚಾರ', privacyText: 'Karnataka CEO ಯ ಸಂಗ್ರಹಿತ ಮತದಾರರ ಪಟ್ಟಿ PDFಗಳಲ್ಲಿ ಜಿಲ್ಲೆ, ವಿಧಾನಸಭಾ ಕ್ಷೇತ್ರ ಮತ್ತು ಭಾಗವನ್ನು ಗುರುತಿಸುವ ಕ್ರಮಬದ್ಧ ಮಾರ್ಗಗಳಿವೆ. ಕ್ರಮಬದ್ಧ ಮಾರ್ಗಗಳು ಸ್ವಯಂಚಾಲನೆ ಮತ್ತು ಸಂಬಂಧ ಜೋಡಣೆಯ ಅಡೆತಡೆಗಳನ್ನು ಕಡಿಮೆ ಮಾಡಬಹುದು. ಈ ಗಮನಿಕೆ ಕಾನೂನುಬಾಹಿರತೆಯ ಆರೋಪವಲ್ಲ. ಈ ಸ್ವತಂತ್ರ ಮಾದರಿಯು ನಿಜವಾದ ವ್ಯಕ್ತಿಗಳ ಎಲ್ಲ ದಾಖಲೆಗಳನ್ನು ಒಟ್ಟಾಗಿ ತೋರಿಸುವ ಪಟ್ಟಿ ಮಾಡದೆ, ನಿರ್ದಿಷ್ಟ ಉದ್ದೇಶದ ಪರ್ಯಾಯವನ್ನು ಪರಿಶೀಲಿಸುತ್ತದೆ.', privacyAccessModels: 'ಒಬ್ಬೊಬ್ಬರು ಸಾರ್ವಜನಿಕವಾಗಿ ಪರಿಶೀಲಿಸುವುದು ಮತ್ತು ಯಂತ್ರದ ಮೂಲಕ ದೊಡ್ಡ ಪ್ರಮಾಣದಲ್ಲಿ ಹುಡುಕುವುದು ವಿಭಿನ್ನ ಪ್ರವೇಶ ವಿಧಾನಗಳಾಗಿವೆ.',
      prototypeTitle: 'ಈ ಮಾದರಿ ಏನು ಮಾಡುತ್ತದೆ', prototypeText: 'ಇದು ಒಂದು ನಿರ್ದಿಷ್ಟ ಹುಡುಕಾಟಕ್ಕೆ ಮಾರ್ಗದರ್ಶನ ನೀಡುತ್ತದೆ, ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ತೋರಿಸುತ್ತದೆ ಮತ್ತು ಮೂಲದ ಸಾಕ್ಷ್ಯವನ್ನು ಪರಿಶೀಲಿಸಲು ಕೇಳುತ್ತದೆ.',
      containsTitle: 'ಈ ಡೆಮೊದಲ್ಲಿರುವುದು', containsText: '120 ಕಾಲ್ಪನಿಕ ಕರ್ನಾಟಕ ದಾಖಲೆಗಳು, ಕೃತಕ PDFಗಳು ಮತ್ತು ಕೃತಕ ಮೂಲದ ಭಾಗದ ಚಿತ್ರಗಳು ಮಾತ್ರ.',
      informedTitle: 'ಇದಕ್ಕೆ ಆಧಾರವಾದ ಅನುಭವ', informedText: 'ಈ ಸಂವಹನ ವಿನ್ಯಾಸವು ಖಾಸಗಿ ಕುಟುಂಬ ಸಂಶೋಧನೆಯಿಂದ ರೂಪುಗೊಂಡಿದೆ; ಈ ಡೆಮೊದಲ್ಲಿ ಕುಟುಂಬದ ಮಾಹಿತಿ ಅಥವಾ ನಿಜವಾದ ಮತದಾರರ ಪಟ್ಟಿಯ ದಾಖಲೆ ಇಲ್ಲ.',
      futureTitle: 'ಇದು ಮುಂದೇನು ಮಾಡಬಹುದು', currentScope: 'ಇಂದು ಕೃತಕ ಕರ್ನಾಟಕ SIR ಮಾದರಿ ಮಾತ್ರ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.', publicNavigationTitle: 'ಸಾರ್ವಜನಿಕ ಮೂಲಗಳ ಮೂಲಕ ಮಾರ್ಗದರ್ಶನ', publicNavigationText: 'ಮುಂದಿನ ಸಾರ್ವಜನಿಕ-ಮೂಲಗಳ ಮಾರ್ಗದರ್ಶನವು ಎಲ್ಲ ದಾಖಲೆಗಳನ್ನು ಒಟ್ಟಾಗಿ ತೋರಿಸುವ ಪಟ್ಟಿ ಮಾಡದೆ ಉಲ್ಲೇಖಿತ ಅಧಿಕೃತ ದಾಖಲೆಗಳನ್ನು ತಲುಪಲು ಸಹಾಯ ಮಾಡಬಹುದು.', authorizedRetrievalTitle: 'ನಾಗರಿಕರ ಅನುಮತಿ ಮತ್ತು ಅಧಿಕಾರಿಯ ನಿರ್ವಹಣೆಯ ದಾಖಲೆ ಪಡೆಯುವಿಕೆ', authorizedRetrievalText: 'ವೈಯಕ್ತಿಕ ಅಥವಾ ನಿರ್ಬಂಧಿತ ದಾಖಲೆಗಳು ಸಂಬಂಧಿತ ಅಧಿಕಾರಿಯ ಸ್ವಂತ ಪ್ರವೇಶ, ಅನುಮತಿ ಮತ್ತು ವಿತರಣಾ ಪ್ರಕ್ರಿಯೆಯಲ್ಲೇ ಇರುತ್ತವೆ. ಅಗತ್ಯವಿದ್ದಲ್ಲಿ ಲಾಗಿನ್, CAPTCHA, OTP, eKYC, ಪಾವತಿ ಅಥವಾ ಒದಗಿಸಲಾದ ಉಲ್ಲೇಖವು ಆ ಅಧಿಕಾರಿಯಲ್ಲೇ ಉಳಿಯುತ್ತದೆ.', futureExamples: 'ಮುಂದಿನ ಉದಾಹರಣೆಗಳು: ಸಾರ್ವಜನಿಕ ಮಾಹಿತಿಯ ಮಿಶ್ರಣ ಮತ್ತು ಅಧಿಕಾರಿಯ ನಿರ್ವಹಣೆಯ ಭೂಮಿ/ಆಸ್ತಿ ಕಾರ್ಯಪ್ರವಾಹಗಳು; ರಕ್ಷಣೆಯೊಂದಿಗೆ ಉಲ್ಲೇಖ-ಆಧಾರಿತ ನ್ಯಾಯಾಲಯದ ಪ್ರಕರಣ ಮತ್ತು ಆದೇಶ ಮಾರ್ಗದರ್ಶನ; ಗೆಜೆಟ್‌ಗಳು ಮತ್ತು ಆದೇಶಗಳು, RERA, ಪರಿಸರ ಅನುಮೋದನೆಗಳು, ಪ್ರಮಾಣಪತ್ರಗಳು, ಸೌಲಭ್ಯಗಳು, ನಗರಸಭೆ ದಾಖಲೆಗಳು ಮತ್ತು ಸಂಗ್ರಹಾಲಯಗಳು.', futureRules: 'ಪ್ರತಿ ಮುಂದಿನ ಮೂಲಕ್ಕೆ ತನ್ನದೇ ಆದ ಪ್ರವೇಶ, ಗೌಪ್ಯತೆ, ಭಾಷೆ, ನಿಖರತೆ ಮತ್ತು ಮೂಲದ ನಿಯಮಗಳು ಬೇಕಾಗುತ್ತವೆ.', officialContext: 'Karnataka CEO ವೆಬ್‌ಸೈಟ್ (ಸಂದರ್ಭಕ್ಕಾಗಿ ಮಾತ್ರ)',
    },
    search: {
      summaryRegionLabel: 'ನಿಮ್ಮ ಹುಡುಕಾಟ',
      summaryHeading: 'ನಿಮ್ಮ ಹುಡುಕಾಟ',
      summaryName: 'ಹೆಸರು',
      summaryRelative: 'ಸಂಬಂಧಿ',
      summaryLocality: 'ಊರು, ವಾರ್ಡ್ ಅಥವಾ ನೆರೆಹೊರೆ',
      summaryAge: 'ವಯಸ್ಸು',
      resultsRegionLabel: 'ಹುಡುಕಾಟದ ಫಲಿತಾಂಶಗಳು',
      reset: 'ಮರುಹೊಂದಿಸಿ',
      unavailable: 'ಹುಡುಕಾಟ ಈಗ ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ. ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ಉಳಿಸಲಾಗಿಲ್ಲ.',
    },
    blankGuide: {
      heading: 'ಈ ಡೆಮೊ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
      enterName: 'ಹೆಸರನ್ನು ಕನ್ನಡದಲ್ಲಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ನಮೂದಿಸಿ.',
      addDetails: 'ತಿಳಿದಿದ್ದರೆ ಕುಟುಂಬದ, ಊರಿನ ಅಥವಾ ಮತದಾರರ ಪಟ್ಟಿಯ ವರ್ಷದ ವಿವರವನ್ನು ಸೇರಿಸಿ.',
      compareMatches: 'ಸಂಭವನೀಯ ಹೊಂದಾಣಿಕೆಗಳನ್ನು ಹೋಲಿಸಿ ಮತ್ತು ಕಾಲ್ಪನಿಕ ಮೂಲವನ್ನು ಪರಿಶೀಲಿಸಿ.',
      privacy: 'ಈ ಡೆಮೊ ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ಉಳಿಸುವುದಿಲ್ಲ ಅಥವಾ ನಿಮ್ಮ ಹುಡುಕಾಟವನ್ನು LLM ಸೇವಾಪೂರೈಕೆದಾರರಿಗೆ ಕಳುಹಿಸುವುದಿಲ್ಲ.',
    },
    safety: {
      notice: 'ಡೆಮೊ ಮಾತ್ರ. ಎಲ್ಲ ದಾಖಲೆಗಳೂ ಕಾಲ್ಪನಿಕ. ನಿಜವಾದ ವೈಯಕ್ತಿಕ ಮಾಹಿತಿಯನ್ನು ನಮೂದಿಸಬೇಡಿ. ನಿಮ್ಮ ನಮೂದುಗಳನ್ನು ಉಳಿಸಲಾಗುವುದಿಲ್ಲ.',
    },
    matchLabels: {
      exact: 'ನಿಖರ ಹೊಂದಾಣಿಕೆ',
      close: 'ಹತ್ತಿರದ ಹೊಂದಾಣಿಕೆ',
      related: 'ಸಂಬಂಧಿತ ಹೊಂದಾಣಿಕೆ',
    },
  },
}

export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => (
    key in values ? String(values[key]) : placeholder
  ))
}

export function displayMatchLabel(value: string, language: Language): string {
  const labels = messages[language].matchLabels
  const knownLabels: Record<string, string> = {
    'Exact match': labels.exact,
    'Close match': labels.close,
    'Related match': labels.related,
  }
  return knownLabels[value] ?? value
}
