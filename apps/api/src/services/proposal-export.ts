import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { ProposalSectionDetail } from '@tenderpilot/shared';

export async function proposalToDocx(title: string, sections: ProposalSectionDetail[]): Promise<Buffer> {
  const children: Paragraph[] = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  for (const section of sections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ children: [new TextRun(section.correctedContent ?? section.content)] }));
    children.push(new Paragraph({ children: [new TextRun({ text: `Sources: ${section.sourceReferences.map((source) => source.label).join(', ')}`, italics: true })] }));
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}