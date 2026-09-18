import { createCurationEntryRoute } from "@/components/curation-entry";

const { EntryPage, generateMetadata } = createCurationEntryRoute("curation");

export { generateMetadata };

export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

export default EntryPage;
