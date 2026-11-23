export type Paper={id:string;title:string;authors:string[];year:number|null;status:string;venue?:string|null;topics:string[];methods:string[];summary:string;question?:string;findings?:string[];stories?:{id:string;title:string;summary?:string;paragraphs?:string[];limitations?:string[];sourcePages?:number[];sourceUrl?:string}[];links:{label:string;url:string}[];fullTextReviewed?:boolean;sourceBasis?:string;sourceUrls?:string[];formerTitles?:string[];legacyIds?:string[]};
export type ResearchFigure={id:string;paperId:string;title:string;caption:string;alt:string;src:string;width:number;height:number;page?:number;figure:string;paperUrl:string;credit?:string;licenseUrl?:string;sourceLabel?:string};
export type SiteData={profile:Record<string,any>;research:Paper[];lastSync?:Record<string,any>|null};
export const TOPICS=['Politics & place','AI & society','Networks & behavior','Environment','Games & history','Methods'];
export const DRIVE_URL='https://drive.google.com/file/d/1BrqPNXyQPgYKTzKbj5nD-EmhQlvbMIeq/view';
export const FORM_URL='https://docs.google.com/forms/d/e/1FAIpQLSfa1hPCgPNZVEkTEK1ZenvCadhhmvpf2r6vVJ2dKpmpkTDRGw/viewform';
