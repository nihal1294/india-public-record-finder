import { ModalDialog } from './ModalDialog'
import type { Messages } from '../i18n'

export function AboutDialog({ copy, closeLabel, onClose }: { copy: Messages['about']; closeLabel: string; onClose: () => void }) {
  return (
    <ModalDialog title={copy.title} closeLabel={closeLabel} onClose={onClose}>
      <section className="about-section"><h3>{copy.whyTitle}</h3><p>{copy.whyText}</p></section>
      <section className="about-section"><h3>{copy.privacyTitle}</h3><p>{copy.privacyText}</p><p>{copy.privacyAccessModels}</p></section>
      <section className="about-section"><h3>{copy.prototypeTitle}</h3><p>{copy.prototypeText}</p></section>
      <section className="about-section"><h3>{copy.containsTitle}</h3><p>{copy.containsText}</p></section>
      <section className="about-section"><h3>{copy.informedTitle}</h3><p>{copy.informedText}</p></section>
      <section className="about-section"><h3>{copy.futureTitle}</h3><p>{copy.currentScope}</p><h4>{copy.publicNavigationTitle}</h4><p>{copy.publicNavigationText}</p><h4>{copy.authorizedRetrievalTitle}</h4><p>{copy.authorizedRetrievalText}</p><p>{copy.futureExamples}</p><p>{copy.futureRules}</p><a href="https://ceo.karnataka.gov.in/" target="_blank" rel="noopener noreferrer">{copy.officialContext}</a></section>
    </ModalDialog>
  )
}
