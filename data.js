const UID=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);
const addDays=(date,n)=>{const d=new Date(date);d.setDate(d.getDate()+n);return d;};
const fmtDate=d=>d.toISOString().slice(0,10);
const WEEK_START=new Date('2026-06-29');

const PHASES=[
  {name:'Literature Survey',range:[1,4],color:'#9ea8f5'},
  {name:'Design & Acquisition',range:[5,8],color:'#67c4e8'},
  {name:'Lab Work & Analysis',range:[9,16],color:'#5fcf8a'},
  {name:'Interpretation',range:[17,20],color:'#d4a84b'},
  {name:'Writing',range:[21,24],color:'#e8905a'},
  {name:'Revision & Submission',range:[25,26],color:'#e07070'},
];

function getPhase(w){return PHASES.find(p=>w>=p.range[0]&&w<=p.range[1])||PHASES[0];}

// [track('a'=astro,'m'=mars,'b'=both), text, priority('h','m','l')]
const WEEK_TASKS=[
  // W1
  [['a','Survey biosignature detection papers in mineral matrices','h'],
   ['a','Map organic-mineral interaction mechanisms (adsorption, intercalation)','h'],
   ['m','Review key papers on Martian alluvial fan formation and classification','h'],
   ['m','Study Mars paleoclimate models for periods of water-flow activity','m']],
  // W2
  [['a','Review clay mineral chemistry: montmorillonite, kaolinite, nontronite','h'],
   ['a','Literature on carbonaceous material preservation in mineral hosts','m'],
   ['m','Review HiRISE and CTX imagery for alluvial fan morphology studies','h'],
   ['m','Literature on sediment transport processes on Mars','m']],
  // W3
  [['a','Study spectroscopic methods (Raman, IR, XRD) for biosignature detection','h'],
   ['a','Compile annotated bibliography of key Astrobiology references','m'],
   ['m','Study terrestrial alluvial fan analogs: Atacama, Antarctic Dry Valleys','h'],
   ['m','Review CRISM spectral data analysis methods and pipelines','m']],
  // W4
  [['a','Write literature review summary (~1500 words)','h'],
   ['a','Identify research gaps and formulate working hypotheses','h'],
   ['m','Write literature review summary for Martian fans (~1500 words)','h'],
   ['m','Identify target fan sites and map data coverage gaps','h']],
  // W5
  [['a','Define mineral specimens for study (montmorillonite, serpentine, jarosite)','h'],
   ['a','Select organic model compounds: amino acids, lipids, nucleobases','h'],
   ['m','Download HiRISE images for selected alluvial fan target sites','h'],
   ['m','Download CTX context imagery and build scene coverage map','m']],
  // W6
  [['a','Design incubation and adsorption experiment protocols','h'],
   ['a','Draft safety protocols and lab notebook structure','m'],
   ['m','Process CRISM data for mineral mapping at fan sites','h'],
   ['m','Build GIS database for all selected fan sites','m']],
  // W7
  [['a','Prepare mineral samples: grinding, sieving, XRD pre-characterization','h'],
   ['a','Set up and calibrate Raman and IR spectrometer','h'],
   ['m','Generate DEMs from HiRISE stereo pairs for key fan sites','h'],
   ['m','Extract morphometric measurements: fan area, slope, apex-to-toe length','m']],
  // W8
  [['a','Run pilot experiments and refine adsorption protocols','h'],
   ['a','Document initial observations and protocol deviations','m'],
   ['m','Quality-control all data products (DEMs, spectral cubes, imagery)','h'],
   ['m','Document data sources, versions, and full processing pipeline','m']],
  // W9
  [['a','Run Series 1: amino acid adsorption onto clay minerals','h'],
   ['a','Collect and log Raman spectra for Series 1 samples','h'],
   ['m','Map fan boundaries and depositional lobes for all target sites','h'],
   ['m','Measure fan apex angles and radial extent profiles','m']],
  // W10
  [['a','Run Series 2: lipid interactions with iron-rich minerals','h'],
   ['a','Process and normalize spectral data from Series 1 & 2','m'],
   ['m','Analyze grain-size proxies from CRISM spectral data','h'],
   ['m','Compare fan morphologies across sites: tabulate key metrics','m']],
  // W11
  [['a','Run Series 3: nucleobase adsorption (adenine, uracil, cytosine)','h'],
   ['a','Begin statistical analysis of adsorption efficiency across minerals','h'],
   ['m','Reconstruct paleodischarge estimates using fan geometry and DEMs','h'],
   ['m','Model sediment flux using slope-area relationships','m']],
  // W12
  [['a','Repeat key experiments for reproducibility confirmation','h'],
   ['a','Update and audit lab notebook entries','m'],
   ['m','Identify stratigraphic relationships and fan lobe superposition','h'],
   ['m','Create cross-sectional profiles from DEMs','m']],
  // W13
  [['a','XRD characterization of reacted mineral samples (pre/post comparison)','h'],
   ['a','Compare pre- and post-interaction Raman spectra for structural shifts','h'],
   ['m','Statistical comparison of fan dimensions across all sites','h'],
   ['m','Cluster analysis to identify distinct morphological fan types','m']],
  // W14
  [['a','SEM/TEM microscopy of selected reacted samples','h'],
   ['a','Quantify organic retention rates and calculate partition coefficients','h'],
   ['m','Finalize morphometric database with all measured parameters','h'],
   ['m','Generate maps and visualizations for all target fan sites','m']],
  // W15
  [['a','Run experimental controls and blanks for all series','h'],
   ['a','Statistical significance testing (ANOVA, t-tests) on adsorption data','h'],
   ['m','Select Earth analog alluvial fans for comparative analysis','h'],
   ['m','Acquire comparable terrestrial datasets: aerial imagery and DEMs','m']],
  // W16
  [['a','Finalize all experimental data collection','h'],
   ['a','Generate summary data tables and publication-quality figures','h'],
   ['m','Compare morphometric parameters: Mars fans vs. Earth analogs','h'],
   ['m','Assess formative climate conditions implied by fan geometry','m']],
  // W17
  [['a','Compare results to published biosignature detection thresholds','h'],
   ['a','Identify anomalies and outliers; assess experimental error sources','m'],
   ['m','Analyze implications for Mars water activity duration and volume','h'],
   ['m','Draft comparative analysis narrative (Mars vs. Earth analogs)','m']],
  // W18
  [['a','Model mineral selectivity for different organic compound classes','h'],
   ['a','Draft interpretation narrative and key findings summary','h'],
   ['m','Discuss tectonic vs. climatic controls on fan morphology','h'],
   ['m','Consult planetary geology collaborators on interpretation','m']],
  // W19
  [['a','Consult supervisor / collaborators on experimental findings','h'],
   ['a','Revise interpretation based on feedback; update figures','m'],
   ['m','Refine comparative analysis based on collaborator feedback','h'],
   ['m','Finalize comparative figures and morphometric visualizations','m']],
  // W20
  [['a','Finalize all figures and tables for Astrobiology manuscript','h'],
   ['a','Synthesize findings into a coherent scientific narrative','h'],
   ['m','Synthesize Mars-Earth fan comparison into cohesive conclusion','h'],
   ['m','Finalize all figures and tables for Martian Fans manuscript','m']],
  // W21
  [['a','Write Introduction and Background (Astrobiology ms.)','h'],
   ['m','Write Introduction and Geological Context (Martian Fans ms.)','h'],
   ['b','Set up shared reference library (Zotero/Mendeley) for both papers','l']],
  // W22
  [['a','Write Materials and Methods section (Astrobiology ms.)','h'],
   ['m','Write Data and Methods section (Martian Fans ms.)','h'],
   ['b','Internal review of methods sections with supervisor','m']],
  // W23
  [['a','Write Results section (Astrobiology ms.)','h'],
   ['m','Write Results section (Martian Fans ms.)','h'],
   ['b','Prepare graphical abstract concepts for both papers','m']],
  // W24
  [['a','Write Discussion and Conclusions (Astrobiology ms.)','h'],
   ['m','Write Discussion and Conclusions (Martian Fans ms.)','h'],
   ['b','Collate full draft manuscripts for internal review','m']],
  // W25
  [['a','Full manuscript review and revision (Astrobiology ms.)','h'],
   ['a','Verify citation formatting to target journal style','m'],
   ['m','Full manuscript review and revision (Martian Fans ms.)','h'],
   ['m','Verify figure quality, DPI, and captions for journal requirements','m']],
  // W26
  [['a','Final proofreading of Astrobiology manuscript','h'],
   ['a','Submit Astrobiology manuscript','h'],
   ['m','Final proofreading of Martian Fans manuscript','h'],
   ['m','Submit Martian Fans manuscript','h']],
];

function generateDefaultWeeks(){
  return WEEK_TASKS.map((taskList,i)=>{
    const weekNum=i+1;
    const start=addDays(WEEK_START,i*7);
    const end=addDays(start,6);
    const tasks=taskList.map(([t,text,pri])=>({
      id:UID(),
      track:t==='a'?'astro':t==='m'?'mars':'both',
      text,
      priority:pri==='h'?'high':pri==='l'?'low':'medium',
      done:false,
    }));
    return{weekNum,startDate:fmtDate(start),endDate:fmtDate(end),tasks,notes:''};
  });
}
