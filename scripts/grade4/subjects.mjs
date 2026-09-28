/**
 * Grade 4 learning areas built from the official KICD Grade 4 Curriculum Designs (Revised 2024).
 * `fileId` is the Google Drive id of the design inside knowledge-base/phase3/curriculum-text.json.gz.
 */
export const GRADE = 'grade-4';
export const GRADE_LABEL = 'Grade 4';

export const GRADE4_SUBJECTS = [
  { slug: 'mathematics', subject: 'MATHEMATICS', fileId: '1o5tDq16yC0Jj1h6zb9mo3dsxtjqXUk4G', core: true },
  { slug: 'english', subject: 'ENGLISH LANGUAGE', fileId: '1o3j3bJwiqJyerdZIFPDJaSprYdTp3Eu1', core: true },
  { slug: 'kiswahili', subject: 'KISWAHILI', fileId: '1MO1ddc7tFvcpKYy7Trr4VBhllBmwKntW', core: true },
  { slug: 'science-and-technology', subject: 'SCIENCE AND TECHNOLOGY', fileId: '1jbAvVAWmif-toAfPShQm9UujN7bZ0luX', core: true },
  { slug: 'agriculture', subject: 'AGRICULTURE', fileId: '1xfUKusjuRlNi22arhYCWy3IS_obPhcvL', core: true },
  { slug: 'social-studies', subject: 'SOCIAL STUDIES', fileId: '1I81sEkJJz7zj2rp4thpUN3MOlHPK5-mG', core: true },
  { slug: 'creative-arts', subject: 'CREATIVE ARTS', fileId: '1NhyGe8EsZLgubbxwEvva-sNUPxDHR8r1', core: true },
  { slug: 'cre', subject: 'CHRISTIAN RELIGIOUS EDUCATION', fileId: '1vW3aipLZDPSkl2z29W7RbBEEUrCdEbt7', core: true },
  { slug: 'ire', subject: 'ISLAMIC RELIGIOUS EDUCATION', fileId: '1ifDV-yVjmntZvnU-7WPLxLLDuborohUh', core: true },
  { slug: 'hre', subject: 'HINDU RELIGIOUS EDUCATION', fileId: '15TMyiOpDL71sr6ZLCn-M-w30XHksCdTy', core: true },
  { slug: 'indigenous-languages', subject: 'INDIGENOUS LANGUAGES', fileId: '1687tUM9DvYbjUIryPMDU2Ve4cF--otB6', core: false },
  { slug: 'french', subject: 'FRENCH', fileId: '18qVRdnMqrdBkf6eGuIDdxHfoAwydu-wv', core: false },
  { slug: 'german', subject: 'GERMAN', fileId: '1YtlkH6n9skVQqt1g15twi54mx8ZUGlDV', core: false },
  { slug: 'arabic', subject: 'ARABIC LANGUAGE', fileId: '1rYeB-zhF68YnNBlozbm9qhwPnPI_i0UF', core: false },
  { slug: 'mandarin', subject: 'MANDARIN', fileId: '1zOfFS4neSdP_8LguOc1FaGPc5DUy80Oj', core: false },
];

export function subjectBySlug(slug) {
  return GRADE4_SUBJECTS.find((s) => s.slug === slug);
}
