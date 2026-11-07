// Formly playground — the sample profile and the sample form's Submit.
(() => {
  const $ = (id) => document.getElementById(id);

  // A fictional student, so visitors can try Formly without typing their own details
  const SAMPLE = {
    fullName: 'Alex Tan',
    preferredName: 'Alex',
    email: 'alex.tan@example.com',
    school: 'Singapore Management University',
    degree: 'Information Systems',
    year: 'Year 2',
    dietary: 'No beef',
    shirtSize: 'M',
    skills: 'Python, SQL, Tableau, prompt engineering',
    experience:
      'Built a Telegram bot that tracks hawker queue times with a friend (Python, Google Sheets). ' +
      'Interned at a logistics start-up cleaning delivery data and building a weekly Tableau dashboard.',
    ccas: 'SMU Volunteers (food bank drives), hall basketball',
    goals: 'Become a data product manager; learn to ship AI features responsibly',
    customFields: [],
    hidden: [],
  };
  const LABELS = {
    fullName: 'Full name', preferredName: 'Preferred name', email: 'Email', school: 'School / university',
    degree: 'Degree / course', year: 'Year of study', dietary: 'Dietary restrictions', shirtSize: 'T-shirt size',
    skills: 'Skills', experience: 'Experience & projects', ccas: 'CCAs & activities', goals: 'Career goals',
  };

  async function showStatus() {
    const { profile } = await chrome.storage.local.get(['profile']);
    $('profileStatus').textContent = profile?.trim()
      ? '👤 Profile ready. Press ✨ Fill with Formly at the bottom right.'
      : 'No profile yet: use the sample profile or write your own first.';
  }

  $('loadSample').addEventListener('click', async () => {
    const profile = Object.entries(LABELS).map(([k, l]) => `${l}: ${SAMPLE[k]}`).join('\n');
    await chrome.storage.local.set({ profileData: SAMPLE, profile });
    showStatus();
  });

  $('sampleForm').addEventListener('submit', (e) => {
    e.preventDefault(); // sample only: nothing is sent anywhere
    $('submitted').hidden = false;
  });

  chrome.storage.onChanged.addListener(showStatus);
  showStatus();
})();
