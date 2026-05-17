// 25 potential 2028 presidential candidates.
// Roles reflect their most relevant/recent public position as of 2026.
//
// Per candidate:
//   hook       — punchy one-line front-card label (≤120 chars)
//   bio_long   — neutral 2-3 short paragraphs for the back of the card
//   storyline  — the "2028 angle" framing (1 short paragraph)
//   policy     — 3-5 short bullets on signature positions
//   moment     — one notable moment, accomplishment, or quote
//   links      — { twitter, wikipedia } — full URLs; null when none
//
// Twitter/Wikipedia URLs are best-effort and should be verified before
// production deploy.
window.CANDIDATES = [
  {
    id: 'ramaswamy',
    name: 'Vivek Ramaswamy',
    party: 'R',
    role: 'Governor of Ohio',
    born: '1985-08-09',
    resume: [
      'Governor of Ohio (2027–pres.)',
      'Co-lead, Department of Government Efficiency (2025)',
      'Founder/CEO, Roivant Sciences (2014–2021)',
    ],
    hook: 'Sold biotech. Picked a fight with the federal bureaucracy. Ended up in Columbus — and still wants the bigger chair.',
    bio_long:
      'Vivek Ramaswamy founded the biotech holding company Roivant Sciences in his twenties and became a fixture on the populist right during the 2024 Republican primary. ' +
      'After exiting the presidential race he was tapped to help shape the Trump administration’s "Department of Government Efficiency" effort, then pivoted to Ohio and won the 2026 governor’s race. ' +
      'He governs as an unconventional executive — heavy on speeches, books, and culture-war framing — while keeping a national platform open.',
    storyline:
      'A potential standard-bearer for younger Republicans drawn to the populist coalition. His Ohio record will define whether he scales as a national candidate.',
    policy: [
      'Dismantle federal agencies he calls redundant; deep civil-service cuts.',
      'Hard-line immigration enforcement; end birthright-citizenship litigation.',
      'Energy-abundance agenda — fast-tracked permitting for oil, gas, nuclear.',
      'Curbs on ESG investing and DEI requirements in higher education.',
    ],
    moment:
      'On the 2024 debate stage at age 38, he called himself "the only person on this stage who isn’t bought and paid for."',
    links: {
      twitter: 'https://twitter.com/VivekGRamaswamy',
      wikipedia: 'https://en.wikipedia.org/wiki/Vivek_Ramaswamy',
    },
  },

  {
    id: 'booker',
    name: 'Cory Booker',
    party: 'D',
    role: 'U.S. Senator from New Jersey',
    born: '1969-04-27',
    resume: [
      'U.S. Senator from New Jersey (2013–pres.)',
      'Mayor of Newark (2006–2013)',
      'Newark City Councilman (1998–2002)',
    ],
    hook: 'Soaring oratory in an era that has stopped clapping. Broke Strom Thurmond’s filibuster record without breaking a sweat.',
    bio_long:
      'Cory Booker rose to national attention as the mayor of Newark, where he was famous for personally responding to constituent emergencies. ' +
      'Elected to the Senate in 2013, he authored the First Step Act, one of the few bipartisan criminal-justice reforms of the last decade. ' +
      'His 2020 presidential run never broke out of single digits, but he kept a national platform through Judiciary Committee work and a 2025 record-breaking 25-hour Senate floor speech.',
    storyline:
      'A safe-hands Democrat with a moral-suasion brand — the question is whether 2028 wants soaring rhetoric or sharper-edged populism.',
    policy: [
      'Federal sentencing reform and clemency expansion.',
      'Baby bonds — government savings accounts seeded at birth.',
      'Voting Rights Act restoration and automatic voter registration.',
      'Tenant protections and rental-assistance expansion.',
    ],
    moment:
      'His 25-hour Senate floor speech in 2025 broke the chamber record held since Strom Thurmond’s 1957 civil-rights filibuster.',
    links: {
      twitter: 'https://twitter.com/CoryBooker',
      wikipedia: 'https://en.wikipedia.org/wiki/Cory_Booker',
    },
  },

  {
    id: 'desantis',
    name: 'Ron DeSantis',
    party: 'R',
    role: 'Governor of Florida',
    born: '1978-09-14',
    resume: [
      'Governor of Florida (2019–pres.)',
      'U.S. Representative, FL-6 (2013–2018)',
      'U.S. Navy JAG officer (2004–2010)',
    ],
    hook: 'Built the red-state laboratory the rest of the GOP copied. Then ran for president and learned charisma isn’t a policy paper.',
    bio_long:
      'A former Navy JAG officer and three-term congressman, Ron DeSantis was elected governor of Florida in 2018 and re-elected by nearly 20 points in 2022. ' +
      'His tenure produced sweeping legislation on school curricula, public-university governance, abortion, and immigration enforcement — turning Florida into the most-watched red-state laboratory of the era. ' +
      'His 2024 presidential run drew early donor enthusiasm but never closed the gap with Trump, and he returned to Tallahassee to finish his term.',
    storyline:
      'An open-lane candidate if Republican voters want the policy substance of Trumpism without Trump. The 2024 stumble is the question hanging over a 2028 run.',
    policy: [
      'Parental-rights laws governing K-12 curricula.',
      'State-led immigration enforcement and transport programs.',
      'Six-week abortion ban; anti-ESG state pension rules.',
      'Tort reform and property-insurance market overhaul.',
    ],
    moment:
      'In 2022 he won re-election by 19 points and flipped Miami-Dade — the first Republican gubernatorial win there in two decades.',
    links: {
      twitter: 'https://twitter.com/RonDeSantis',
      wikipedia: 'https://en.wikipedia.org/wiki/Ron_DeSantis',
    },
  },

  {
    id: 'buttigieg',
    name: 'Pete Buttigieg',
    party: 'D',
    role: 'Former U.S. Secretary of Transportation',
    born: '1982-01-19',
    resume: [
      'U.S. Secretary of Transportation (2021–2025)',
      'Mayor of South Bend, Indiana (2012–2020)',
      'U.S. Navy Reserve intelligence officer (2009–2017)',
    ],
    hook: 'The Rhodes Scholar who treats cable news like a chess clock. Already ran a $1.2T law — and every debate stage he stepped on.',
    bio_long:
      'Pete Buttigieg was the two-term mayor of South Bend, Indiana, before his 2020 presidential run made him the first openly gay candidate to win a state primary contest. ' +
      'As President Biden’s transportation secretary he led implementation of the $1.2T bipartisan infrastructure law, navigating supply-chain crises, the East Palestine derailment, and an FAA staffing fight. ' +
      'He moved to Michigan after leaving DOT and has been on heavy speaking-circuit duty ever since.',
    storyline:
      'A debate-stage natural with cross-aisle media reach — and the Biden-era résumé that some Democrats may want to either lean on or run from.',
    policy: [
      'Long-term infrastructure investment, including rail and ports.',
      'Pre-K expansion and child-tax-credit revival.',
      'Marriage and LGBTQ protections in federal law.',
      'Auto-industry transition support for EV manufacturing.',
    ],
    moment:
      'His 2020 Iowa caucus night ended in a virtual tie with Bernie Sanders — the first openly gay candidate to win delegates from a state contest.',
    links: {
      twitter: 'https://twitter.com/PeteButtigieg',
      wikipedia: 'https://en.wikipedia.org/wiki/Pete_Buttigieg',
    },
  },

  {
    id: 'scott',
    name: 'Tim Scott',
    party: 'R',
    role: 'U.S. Senator from South Carolina',
    born: '1965-09-19',
    resume: [
      'U.S. Senator from South Carolina (2013–pres.)',
      'U.S. Representative, SC-1 (2011–2013)',
      'Charleston County Councilman (1995–2009)',
    ],
    hook: 'The only Black Republican in the Senate, selling Reaganite optimism in a party that has moved past it. Sunny where everyone else is angry.',
    bio_long:
      'Tim Scott is the only Black Republican currently in the U.S. Senate, appointed to the seat in 2013 and elected three times since. ' +
      'He chairs the Senate Banking, Housing, and Urban Affairs Committee, where he has pushed the bipartisan opportunity-zone tax program he co-authored in 2017. ' +
      'His 2024 presidential campaign ended after a fourth-place finish in the Iowa caucuses; he endorsed Donald Trump and was on the 2024 VP shortlist.',
    storyline:
      'A bridge-builder pitch in a primary system that has rewarded sharper rhetoric — testable as a general-election asset.',
    policy: [
      'Opportunity zones and small-business tax credits.',
      'School-choice expansion through federal grants.',
      'Bank-regulation rollback and capital-formation rules.',
      'Police-reform bill (Justice Act) that he authored in 2020.',
    ],
    moment:
      'His 2023 State of the Union response opened with a line about being raised by a single mother in a poverty-line household — a recurring theme in his pitch.',
    links: {
      twitter: 'https://twitter.com/SenatorTimScott',
      wikipedia: 'https://en.wikipedia.org/wiki/Tim_Scott',
    },
  },

  {
    id: 'ossoff',
    name: 'Jon Ossoff',
    party: 'D',
    role: 'U.S. Senator from Georgia',
    born: '1987-02-16',
    resume: [
      'U.S. Senator from Georgia (2021–pres.)',
      'Chair, Permanent Subcommittee on Investigations (2023–pres.)',
      'Investigative documentary producer (2013–2017)',
    ],
    hook: 'Flipped Georgia at 33, then walked off cable news on purpose. Investigates prisons and contractors for sport.',
    bio_long:
      'Jon Ossoff became the youngest sitting U.S. senator at 33 after winning the 2021 Georgia runoff that delivered Democrats their Senate majority. ' +
      'Before politics he produced investigative documentaries on corruption and human rights. ' +
      'As chair of the Permanent Subcommittee on Investigations he has run high-profile probes into prison conditions, military housing, and detention contractor abuses.',
    storyline:
      'A new-generation Democrat from a purple state who has avoided national-celebrity overexposure — a sleeper if the party wants a fresh face.',
    policy: [
      'Aggressive oversight of federal contractors and prisons.',
      'Voting Rights Act restoration and election-security funding.',
      'Maternal-health and rural-hospital investment.',
      'Microchip and clean-energy manufacturing for Georgia.',
    ],
    moment:
      'His 2021 runoff win — alongside Raphael Warnock — handed Democrats Senate control on the same week as the Jan. 6 Capitol riot.',
    links: {
      twitter: 'https://twitter.com/ossoff',
      wikipedia: 'https://en.wikipedia.org/wiki/Jon_Ossoff',
    },
  },

  {
    id: 'rfk',
    name: 'Robert F. Kennedy Jr.',
    party: 'I',
    role: 'U.S. Secretary of Health & Human Services',
    born: '1954-01-17',
    resume: [
      'U.S. Secretary of Health & Human Services (2025–pres.)',
      'Founder, Waterkeeper Alliance (1999–2024)',
      'Environmental attorney, Hudson Riverkeeper (1986–2017)',
    ],
    hook: 'Kennedy by name, contrarian by trade. Running American public health on instincts that scare half the medical establishment.',
    bio_long:
      'Robert F. Kennedy Jr. spent decades as an environmental attorney, founding Waterkeeper Alliance and litigating major Hudson River and PCB cases. ' +
      'He ran for president in 2024, first as a Democrat and then as an independent, before withdrawing and endorsing Donald Trump. ' +
      'As HHS Secretary he has driven a "Make America Healthy Again" agenda — food-additive review, chronic-disease focus, and vaccine-policy revisions that have drawn both supporters and sharp criticism from public-health officials.',
    storyline:
      'A wildcard with cross-coalition reach — environmentalists, vaccine skeptics, and anti-establishment voters all sit in his column.',
    policy: [
      'Ban or reformulate common food additives.',
      'Reopen vaccine safety reviews; alter ACIP recommendations.',
      'Crack down on pharmaceutical advertising and PBM practices.',
      'Phase out fluoridation guidance from federal agencies.',
    ],
    moment:
      'His 2025 confirmation hearings were among the most contentious of the Trump cabinet, advancing on a narrow Senate vote.',
    links: {
      twitter: 'https://twitter.com/RobertKennedyJr',
      wikipedia: 'https://en.wikipedia.org/wiki/Robert_F._Kennedy_Jr.',
    },
  },

  {
    id: 'cuban',
    name: 'Mark Cuban',
    party: 'I',
    role: 'Entrepreneur and investor',
    born: '1958-07-31',
    resume: [
      'Founder, Cost Plus Drugs (2022–pres.)',
      'Owner, Dallas Mavericks (2000–2023)',
      'Founder/CEO, Broadcast.com (1995–1999)',
    ],
    hook: 'Won an NBA title. Blew up the drug-pricing model. Flirted with running every cycle and never filed.',
    bio_long:
      'Mark Cuban built his fortune selling Broadcast.com to Yahoo in 1999 for $5.7B in stock. He bought the Dallas Mavericks in 2000, won an NBA title in 2011, and sold majority control of the team in 2023. ' +
      'He launched Cost Plus Drugs in 2022 — a generic-drug marketplace built on transparent markups — and remains a fixture on Shark Tank. ' +
      'He has flirted publicly with independent presidential bids in multiple cycles without ever filing.',
    storyline:
      'The "outside the political system" lane, with name recognition and money — though every prior cycle ended without him running.',
    policy: [
      'Drug-pricing transparency and PBM reform.',
      'Pragmatic centrist fiscal positioning.',
      'AI regulation focused on transparency, not bans.',
      'Tax simplification with closed corporate loopholes.',
    ],
    moment:
      'Cost Plus Drugs publicly publishes its acquisition cost on every generic — a direct shot at the PBM model.',
    links: {
      twitter: 'https://twitter.com/mcuban',
      wikipedia: 'https://en.wikipedia.org/wiki/Mark_Cuban',
    },
  },

  {
    id: 'carlson',
    name: 'Tucker Carlson',
    party: 'R',
    role: 'Independent media commentator',
    born: '1969-05-16',
    resume: [
      'Host, The Tucker Carlson Network (2023–pres.)',
      'Host, Tucker Carlson Tonight, Fox News (2016–2023)',
      'Co-founder, The Daily Caller (2010–2020)',
    ],
    hook: 'Built the loudest microphone on the populist right after Fox cut him loose. Sat across from Putin and pulled 200M views.',
    bio_long:
      'Tucker Carlson hosted the highest-rated cable news show in America at Fox News from 2016 until his abrupt April 2023 departure. ' +
      'He launched The Tucker Carlson Network as a subscription and X-distributed show, conducted a high-profile interview with Vladimir Putin in 2024, and has hosted multiple GOP candidates and Trump administration officials. ' +
      'He has not held elected office and has repeatedly waved off speculation about running.',
    storyline:
      'Has more cultural pull than most senators in the GOP base — would reshape any primary he entered, even briefly.',
    policy: [
      'America-first foreign policy; skepticism of Ukraine aid and NATO.',
      'Immigration restriction as a unifying domestic theme.',
      'Anti-monopoly framing applied to tech platforms.',
      'Cultural conservatism rooted in family and faith.',
    ],
    moment:
      'His 2024 Moscow interview with Vladimir Putin drew over 200 million views on X within days of release.',
    links: {
      twitter: 'https://twitter.com/TuckerCarlson',
      wikipedia: 'https://en.wikipedia.org/wiki/Tucker_Carlson',
    },
  },

  {
    id: 'stefanik',
    name: 'Elise Stefanik',
    party: 'R',
    role: 'Governor of New York',
    born: '1984-07-02',
    resume: [
      'Governor of New York (2027–pres.)',
      'Chair, House Republican Conference (2021–2025)',
      'U.S. Representative, NY-21 (2015–2027)',
    ],
    hook: 'Took out two Ivy League presidents in a single hearing. Then took Albany — the first red governor of New York in 20 years.',
    bio_long:
      'Elise Stefanik was elected to the U.S. House at 30, the youngest woman ever at the time, and rose to chair the House Republican Conference after Liz Cheney was ousted in 2021. ' +
      'Her viral December 2023 questioning of Ivy League presidents on antisemitism led directly to two resignations and made her a Trump-orbit favorite. ' +
      'She won the New York governorship in 2026, ending a two-decade Democratic hold on the office.',
    storyline:
      'A Trump-aligned executive in a blue state — proof of concept for a Republican who can win outside the South. Her record in Albany will define how plausibly she scales.',
    policy: [
      'Bail-reform rollback and increased state-trooper funding.',
      'Energy permitting reform; restart of New York nuclear plants.',
      'Antisemitism-focused federal and state policy.',
      'Charter-school expansion and curriculum review.',
    ],
    moment:
      'Her December 2023 House hearing exchange — "calling for the genocide of Jews… is that bullying or harassment?" — went viral within hours.',
    links: {
      twitter: 'https://twitter.com/EliseStefanik',
      wikipedia: 'https://en.wikipedia.org/wiki/Elise_Stefanik',
    },
  },

  {
    id: 'mace',
    name: 'Nancy Mace',
    party: 'R',
    role: 'U.S. Representative from South Carolina',
    born: '1977-12-04',
    resume: [
      'U.S. Representative, SC-1 (2021–pres.)',
      'South Carolina State Representative (2018–2020)',
      'First woman graduate of The Citadel (1999)',
    ],
    hook: 'Pro-IVF, anti-McCarthy, and on-camera every chance she gets. Hard to pin to a lane — that is the point.',
    bio_long:
      'Nancy Mace was the first woman to graduate from The Citadel — South Carolina’s military college — before winning a state House seat and then a U.S. House seat in 2020. ' +
      'She has alternated between hard-line and moderate positions, supporting contraception access and IVF protections while also voting to remove Speaker Kevin McCarthy in 2023. ' +
      'She sits on the House Oversight Committee, where she has been a vocal questioner in high-profile hearings.',
    storyline:
      'A long-shot but distinctive primary entrant — could carve a niche if the party leaves an opening for women’s-health pragmatism.',
    policy: [
      'IVF and contraception protections in federal law.',
      'Cryptocurrency regulation reform; digital-asset clarity.',
      'Federal-spending and oversight hardball.',
      'Veterans’ mental-health investment.',
    ],
    moment:
      'In 2020 she flipped a coastal South Carolina House seat held by Joe Cunningham, taking the district Republican for the first time in two decades.',
    links: {
      twitter: 'https://twitter.com/NancyMace',
      wikipedia: 'https://en.wikipedia.org/wiki/Nancy_Mace',
    },
  },

  {
    id: 'aoc',
    name: 'Alexandria Ocasio-Cortez',
    party: 'D',
    role: 'U.S. Representative from New York',
    born: '1989-10-13',
    resume: [
      'U.S. Representative, NY-14 (2019–pres.)',
      'Sanders 2016 organizer (2016)',
      'Bartender, Flats Fix, Union Square (2017–2018)',
    ],
    hook: 'Squad founder. Largest social-media reach in Congress. Was online before she was in office — and the generational handoff Democrats keep delaying.',
    bio_long:
      'Alexandria Ocasio-Cortez upset a ten-term incumbent in a 2018 Bronx-Queens primary at age 28, becoming the youngest woman ever elected to Congress. ' +
      'She has built a national platform around climate policy, housing, and tax fairness, anchored by an Instagram-and-livestream communication style with few peers on Capitol Hill. ' +
      'She sits on the Oversight Committee and has chaired Democratic Socialists of America-aligned legislative pushes including the Green New Deal framework.',
    storyline:
      'The clearest progressive lane in 2028 — and a generational-handoff symbol. Whether the broader party is ready to nominate her is the open question.',
    policy: [
      'Green New Deal framework — clean-energy industrial policy.',
      'Medicare for All as a single-payer system.',
      'Federal rent stabilization and public-housing investment.',
      'Wealth tax on ultra-high net worth households.',
    ],
    moment:
      'Her 2018 primary win over Joe Crowley — a sitting House Democratic Caucus chair — was the biggest incumbent upset of the cycle.',
    links: {
      twitter: 'https://twitter.com/AOC',
      wikipedia: 'https://en.wikipedia.org/wiki/Alexandria_Ocasio-Cortez',
    },
  },

  {
    id: 'vance',
    name: 'J.D. Vance',
    party: 'R',
    role: 'Vice President of the United States',
    born: '1984-08-02',
    resume: [
      'Vice President of the United States (2025–pres.)',
      'U.S. Senator from Ohio (2023–2025)',
      'Author, Hillbilly Elegy (2016)',
    ],
    hook: 'Yale Law to venture capital to Trump’s heir apparent. The whole 2028 GOP primary calendar bends around whether he wants it.',
    bio_long:
      'J.D. Vance grew up in Middletown, Ohio, served four years in the Marines, and wrote the bestselling memoir Hillbilly Elegy in 2016. ' +
      'After a venture-capital career he won the Ohio Senate seat in 2022 with Trump’s endorsement. ' +
      'Donald Trump picked him as his 2024 running mate, and Vance has used the vice presidency to maintain a constant travel schedule — including an early-2026 Iowa swing — while staying loyal to the boss.',
    storyline:
      'The closest thing to a Trump heir-apparent. The whole 2028 GOP primary calendar will revolve around whether he runs and how openly.',
    policy: [
      'Industrial policy and tariff support for U.S. manufacturing.',
      'Restrictionist immigration as economic policy.',
      'Skepticism of long-term U.S. aid to Ukraine.',
      'Family-formation tax credits; child-tax-credit expansion.',
    ],
    moment:
      'His 2024 RNC acceptance speech leaned heavily on his Appalachian biography to frame a working-class realignment thesis.',
    links: {
      twitter: 'https://twitter.com/JDVance',
      wikipedia: 'https://en.wikipedia.org/wiki/JD_Vance',
    },
  },

  {
    id: 'newsom',
    name: 'Gavin Newsom',
    party: 'D',
    role: 'Governor of California',
    born: '1967-10-10',
    resume: [
      'Governor of California (2019–pres.)',
      'Lt. Governor of California (2011–2019)',
      'Mayor of San Francisco (2004–2011)',
    ],
    hook: 'Picks fights with Trump for sport. The Democrat finally willing to swing back.',
    bio_long:
      'Gavin Newsom served as mayor of San Francisco, lieutenant governor, and then governor of California, where he was easily re-elected in 2022 and finished his second term in early 2027. ' +
      'He has used the office to pick high-profile fights with Republican governors, on issues from gun policy and abortion to oil-industry regulation. ' +
      'His "This is California" podcast and 2023 DeSantis debate on Fox News positioned him as the party’s most willing brawler.',
    storyline:
      'The Democratic field’s most camera-ready prosecutor of the Republican agenda — open question whether the party wants California-coded liberalism leading the ticket.',
    policy: [
      'Reproductive-rights protections as model legislation.',
      'Aggressive climate and emissions targets.',
      'Gun-violence prevention via federal-style California laws.',
      'Single-payer health-care interest at the state level.',
    ],
    moment:
      'His 2023 Fox News debate against Ron DeSantis aired in primetime, drawing nearly five million viewers.',
    links: {
      twitter: 'https://twitter.com/GavinNewsom',
      wikipedia: 'https://en.wikipedia.org/wiki/Gavin_Newsom',
    },
  },

  {
    id: 'gaetz',
    name: 'Matt Gaetz',
    party: 'R',
    role: 'Conservative commentator',
    born: '1982-05-07',
    resume: [
      'Host, nightly OAN program (2025–pres.)',
      'AG nominee, Trump administration (Nov 2024, withdrawn)',
      'U.S. Representative, FL-1 (2017–2025)',
    ],
    hook: 'Took down a Speaker. Blew up his own AG nomination in a week. Loud and unsponsored — exactly the brand.',
    bio_long:
      'Matt Gaetz represented Florida’s Panhandle in the U.S. House for four terms and led the 2023 motion to vacate that removed Speaker Kevin McCarthy. ' +
      'In late 2024 he was named Donald Trump’s attorney general nominee, then withdrew within a week amid Senate opposition and a House Ethics Committee report. ' +
      'He now hosts a nightly OAN program and remains a prominent voice in MAGA media.',
    storyline:
      'A small but loud constituency; a long-shot run would be more about platform than primary delegates.',
    policy: [
      'Anti-establishment GOP reform; opposition to leadership pacts.',
      'Drug-policy reform — federal cannabis decriminalization.',
      'Term limits and lobbying restrictions.',
      'Restrictionist immigration and border enforcement.',
    ],
    moment:
      'In October 2023 he became the first member of Congress to successfully invoke a motion to vacate against a sitting Speaker of the House.',
    links: {
      twitter: 'https://twitter.com/mattgaetz',
      wikipedia: 'https://en.wikipedia.org/wiki/Matt_Gaetz',
    },
  },

  {
    id: 'talarico',
    name: 'James Talarico',
    party: 'D',
    role: 'Texas State Representative',
    born: '1989-09-24',
    resume: [
      'Texas State Representative, Dist. 50 (2019–pres.)',
      'Seminary student, Austin Presbyterian (2023–pres.)',
      'Middle-school English teacher, San Antonio (2014–2017)',
    ],
    hook: 'A teacher quoting scripture against vouchers. The Democrat figuring out how to talk to the church about the church.',
    bio_long:
      'James Talarico taught middle-school English in San Antonio before winning a state House seat in 2018 at age 29. ' +
      'A current seminary student, he has built a national audience through floor speeches that frame Christian theology against vouchers, abortion bans, and school-prayer mandates. ' +
      'Clips of his exchanges routinely cross over to non-political audiences and have made him a fundraising magnet far beyond his Austin-area district.',
    storyline:
      'A long-shot generational entrant — a Texas Democrat with a values-language pitch that could matter more in the general than the primary.',
    policy: [
      'Public-school funding over private-voucher programs.',
      'Separation of church and state in classroom mandates.',
      'Tighter gun-storage requirements after Uvalde.',
      'Medicaid expansion in Texas.',
    ],
    moment:
      'His 2023 floor exchange opposing the Ten Commandments-in-classrooms bill went viral on TikTok and YouTube within hours.',
    links: {
      twitter: 'https://twitter.com/jamestalarico',
      wikipedia: 'https://en.wikipedia.org/wiki/James_Talarico',
    },
  },

  {
    id: 'rubio',
    name: 'Marco Rubio',
    party: 'R',
    role: 'U.S. Secretary of State',
    born: '1971-05-28',
    resume: [
      'U.S. Secretary of State (2025–pres.)',
      'U.S. Senator from Florida (2011–2025)',
      'Speaker, Florida House of Representatives (2007–2008)',
    ],
    hook: 'Tea Party kid grown into Trump’s diplomat. 99–0 confirmation, hawkish in three theaters, Vance’s likeliest rival or running mate.',
    bio_long:
      'Marco Rubio served as speaker of the Florida House, won a U.S. Senate seat in 2010 in a celebrated Tea Party–era upset, and ran for president in 2016. ' +
      'In the Senate he chaired the Intelligence Committee and championed sanctions against the Cuban and Venezuelan regimes. ' +
      'Donald Trump named him Secretary of State at the start of his second term, where he has led a hawkish posture toward China, Iran, and Latin American autocracies.',
    storyline:
      'A natural Vance ally — or his top primary competitor — depending on whether they run together or against each other.',
    policy: [
      'Confrontational posture toward China across trade and tech.',
      'Latin America–first hemisphere strategy; Venezuela sanctions.',
      'Israel-aligned Middle East policy.',
      'Industrial-policy support for U.S. tech and chip manufacturing.',
    ],
    moment:
      'His January 2025 confirmation as Secretary of State drew a 99–0 Senate vote — a rarity in the current chamber.',
    links: {
      twitter: 'https://twitter.com/marcorubio',
      wikipedia: 'https://en.wikipedia.org/wiki/Marco_Rubio',
    },
  },

  {
    id: 'harris',
    name: 'Kamala Harris',
    party: 'D',
    role: 'Former Vice President',
    born: '1964-10-20',
    resume: [
      'Vice President of the United States (2021–2025)',
      'U.S. Senator from California (2017–2021)',
      'Attorney General of California (2011–2017)',
    ],
    hook: 'Highest name ID in the field. Also the biggest open question — does the party want a rematch or a reset?',
    bio_long:
      'Kamala Harris served as district attorney of San Francisco, California attorney general, and U.S. senator before becoming the first woman and first Black or South Asian American vice president in 2021. ' +
      'She became the Democratic nominee in 2024 after Joe Biden withdrew, losing to Donald Trump in the closest electoral vote since 2000. ' +
      'Since leaving office she has remained on the speaking circuit and authored a 2025 book about the campaign.',
    storyline:
      'Highest universal name recognition in the field — cutting both ways. Whether Democrats want a clean break from the Biden era is the single biggest variable.',
    policy: [
      'Reproductive-rights protections as a federal floor.',
      'Affordable Care Act expansion and prescription-cost caps.',
      'Cannabis decriminalization and sentencing reform.',
      'Tax fairness and small-business deduction expansion.',
    ],
    moment:
      'Her 2024 nomination came together in 35 days after President Biden withdrew — the fastest major-party top-of-ticket consolidation in modern history.',
    links: {
      twitter: 'https://twitter.com/KamalaHarris',
      wikipedia: 'https://en.wikipedia.org/wiki/Kamala_Harris',
    },
  },

  {
    id: 'hegseth',
    name: 'Pete Hegseth',
    party: 'R',
    role: 'U.S. Secretary of Defense',
    born: '1980-06-06',
    resume: [
      'U.S. Secretary of Defense (2025–pres.)',
      'Co-host, Fox & Friends Weekend (2014–2024)',
      'Army National Guard, Iraq/Afghanistan (2003–2014)',
    ],
    hook: 'Confirmed by a tiebreak. Governs the Pentagon like a cable segment. "Warrior ethos" is the slogan — the rest is contested.',
    bio_long:
      'Pete Hegseth served in the Army National Guard with deployments to Iraq, Afghanistan, and Guantanamo before becoming a Fox News host. ' +
      'Donald Trump nominated him as Secretary of Defense in late 2024, and he was confirmed in early 2025 after a sharply contested hearing process. ' +
      'At the Pentagon he has prioritized changes to recruiting standards, DEI-program elimination, and what he describes as a "warrior ethos" overhaul.',
    storyline:
      'No prior bid for office, but the Defense portfolio has produced presidential candidates before — and he has the MAGA-media profile to monetize a run.',
    policy: [
      '"Warrior ethos" force-readiness reforms.',
      'DEI-program elimination across the services.',
      'Recruiting and accession-standard revisions.',
      'Hard-edged border-deployment posture for the National Guard.',
    ],
    moment:
      'His 2025 Senate confirmation cleared on a 51–50 tiebreaking vote from Vice President J.D. Vance.',
    links: {
      twitter: 'https://twitter.com/PeteHegseth',
      wikipedia: 'https://en.wikipedia.org/wiki/Pete_Hegseth',
    },
  },

  {
    id: 'moore',
    name: 'Wes Moore',
    party: 'D',
    role: 'Governor of Maryland',
    born: '1978-10-15',
    resume: [
      'Governor of Maryland (2023–pres.)',
      'CEO, Robin Hood Foundation (2017–2022)',
      'Army captain, 82nd Airborne, Afghanistan (2005–2014)',
    ],
    hook: 'Rhodes Scholar, paratrooper, bestseller, governor — and had never run for anything before Annapolis. The party elders’ favorite name nobody has heard of.',
    bio_long:
      'Wes Moore was a Rhodes Scholar and Army captain who deployed to Afghanistan, then ran the Robin Hood Foundation — one of New York’s largest anti-poverty organizations. ' +
      'His memoir The Other Wes Moore was a bestseller and a high-school staple. ' +
      'He won the Maryland governorship in 2022 — his first elected office — and has used the role to push child-poverty, service-year, and economic-mobility legislation.',
    storyline:
      'The "fresh face" lane that 2008-era Obama enthusiasm now lives in. Donor and party-elder excitement is well ahead of public name recognition.',
    policy: [
      'Service-year programs for young adults.',
      'Child-poverty reduction targets in state policy.',
      'Climate-aligned port and offshore-wind investment.',
      'Cannabis legalization with equity-focused licensing.',
    ],
    moment:
      'His 2023 inauguration made him only the third Black person elected governor of any U.S. state.',
    links: {
      twitter: 'https://twitter.com/GovWesMoore',
      wikipedia: 'https://en.wikipedia.org/wiki/Wes_Moore',
    },
  },

  {
    id: 'cruz',
    name: 'Ted Cruz',
    party: 'R',
    role: 'U.S. Senator from Texas',
    born: '1970-12-22',
    resume: [
      'U.S. Senator from Texas (2013–pres.)',
      'Texas Solicitor General (2003–2008)',
      'Director, FTC Office of Policy Planning (2001–2003)',
    ],
    hook: 'Argued nine cases at the Supreme Court. Lost 2016 to a guy who insulted his wife. Came back with a podcast empire — hated, and re-elected anyway.',
    bio_long:
      'Ted Cruz served as Texas solicitor general — arguing nine cases before the U.S. Supreme Court — before winning his Senate seat in 2012. ' +
      'He finished second to Donald Trump in the 2016 Republican primary and survived a closer-than-expected 2018 re-election against Beto O’Rourke. ' +
      'He is the ranking Republican on the Senate Commerce Committee and hosts a thrice-weekly podcast that has become a fundraising and platform anchor.',
    storyline:
      'A known quantity with infrastructure and donor relationships in place — the question is whether 2028 wants a familiar face after a wave of newer names.',
    policy: [
      'Tax-and-regulation reduction; school-choice expansion.',
      'Border-enforcement and asylum-policy restrictions.',
      'AI-and-tech committee-of-record hardball.',
      'Israel and Latin America–focused foreign policy.',
    ],
    moment:
      'His record-breaking 2013 Senate floor speech against the Affordable Care Act ran 21 hours and included a recitation of Dr. Seuss.',
    links: {
      twitter: 'https://twitter.com/tedcruz',
      wikipedia: 'https://en.wikipedia.org/wiki/Ted_Cruz',
    },
  },

  {
    id: 'shapiro',
    name: 'Josh Shapiro',
    party: 'D',
    role: 'Governor of Pennsylvania',
    born: '1973-06-20',
    resume: [
      'Governor of Pennsylvania (2023–pres.)',
      'Pennsylvania Attorney General (2017–2023)',
      'Pennsylvania State Representative (2005–2012)',
    ],
    hook: 'Rebuilt a Philly interstate in 12 days. Wins Pennsylvania. Whoever holds that state in 2028 probably holds the country.',
    bio_long:
      'Josh Shapiro served two terms as Pennsylvania attorney general — including a high-profile clergy-abuse grand-jury report — before winning the governor’s race in 2022 by nearly 15 points. ' +
      'He has made bipartisan budget deals a calling card and signed major infrastructure and education funding packages. ' +
      'He was on Kamala Harris’s 2024 VP shortlist before Tim Walz was selected.',
    storyline:
      'The "wins Pennsylvania" lane — the most important swing state in any plausible 2028 map. His Israel-and-campus-protest positioning is a primary-cycle variable.',
    policy: [
      'Bipartisan infrastructure and energy permitting deals.',
      'Public-school funding fight in PA courts and budget.',
      'Reproductive-rights protections at the state level.',
      'Marijuana legalization push at the state level.',
    ],
    moment:
      'He ordered an interstate bridge in Philadelphia rebuilt in 12 days after a 2023 tanker fire — a logistics moment that briefly went national.',
    links: {
      twitter: 'https://twitter.com/GovernorShapiro',
      wikipedia: 'https://en.wikipedia.org/wiki/Josh_Shapiro',
    },
  },

  {
    id: 'greene',
    name: 'Marjorie Taylor Greene',
    party: 'R',
    role: 'U.S. Representative from Georgia',
    born: '1974-05-27',
    resume: [
      'U.S. Representative, GA-14 (2021–pres.)',
      'House Freedom Caucus member (2021–pres.)',
      'Co-owner, Taylor Commercial construction (2002–2020)',
    ],
    hook: 'The chamber’s loudest member, file-a-motion-to-vacate division. A run would be about volume — and volume gets its share of votes.',
    bio_long:
      'Marjorie Taylor Greene was elected to Congress in 2020 from a deep-red northwest Georgia district. ' +
      'She has been a House Freedom Caucus stalwart, was briefly stripped of committee assignments by Democrats in 2021, and was restored to them when Republicans took the House majority in 2023. ' +
      'She has filed multiple motions to vacate the Speaker’s chair and remains one of the chamber’s most visible Trump-aligned members.',
    storyline:
      'A long-shot run would be primarily about platform amplification and influence over the GOP nominee’s positioning.',
    policy: [
      'Sharp immigration restriction and border-enforcement priority.',
      'Skepticism of U.S. military aid to Ukraine.',
      'Anti-globalist framing on trade and institutions.',
      'Investigations of federal agencies including the FBI and DOJ.',
    ],
    moment:
      'In May 2024 her motion to vacate against Speaker Mike Johnson failed when most Democrats voted to table the resolution.',
    links: {
      twitter: 'https://twitter.com/RepMTG',
      wikipedia: 'https://en.wikipedia.org/wiki/Marjorie_Taylor_Greene',
    },
  },

  {
    id: 'klobuchar',
    name: 'Amy Klobuchar',
    party: 'D',
    role: 'U.S. Senator from Minnesota',
    born: '1960-05-25',
    resume: [
      'U.S. Senator from Minnesota (2007–pres.)',
      '2026 Minnesota gubernatorial candidate',
      'Hennepin County Attorney (1999–2007)',
    ],
    hook: 'Pragmatic Midwest. Bill-count champion of the Senate. Running for governor at home with one eye on Iowa.',
    bio_long:
      'Amy Klobuchar has represented Minnesota in the Senate since 2007, winning re-election three times and earning a reputation as a high-volume legislator on antitrust, agriculture, and election-security bills. ' +
      'She ran in the 2020 Democratic primary, won the New Hampshire primary debate cycle, and dropped out before Super Tuesday to endorse Joe Biden. ' +
      'She announced a 2026 run for Minnesota governor — but a presidential bid two years later is not off the table.',
    storyline:
      'A pragmatic-Midwest case the party has flirted with for two cycles. Whether she runs depends in part on how the governor race plays out.',
    policy: [
      'Antitrust enforcement and Big Tech competition policy.',
      'Election-security funding and voting-rights protections.',
      'Prescription-drug price negotiation expansion.',
      'Agriculture-aligned rural broadband and farm-bill priorities.',
    ],
    moment:
      'Her 2020 New Hampshire primary night third-place finish briefly made her the surprise story of the early-state cycle.',
    links: {
      twitter: 'https://twitter.com/amyklobuchar',
      wikipedia: 'https://en.wikipedia.org/wiki/Amy_Klobuchar',
    },
  },

  {
    id: 'bannon',
    name: 'Steve Bannon',
    party: 'R',
    role: 'Host of War Room',
    born: '1953-11-27',
    resume: [
      'Host, War Room podcast (2019–pres.)',
      'White House Chief Strategist (Jan–Aug 2017)',
      'Executive chair, Breitbart News (2012–2018)',
    ],
    hook: 'Architect of the populist-right media machine. Won’t run himself — but no GOP primary lane gets oxygen without his nod.',
    bio_long:
      'Steve Bannon ran Breitbart News, served as Donald Trump’s 2016 campaign CEO, and then White House chief strategist for the first seven months of the Trump administration. ' +
      'His daily War Room podcast has become a key venue for MAGA-coalition organizing and primary-campaign endorsements. ' +
      'He served a four-month prison sentence for contempt of Congress in 2024 and remained a fixture in conservative media throughout.',
    storyline:
      'Not a likely candidate himself, but a kingmaker whose preferences will shape the 2028 GOP primary lanes from outside the field.',
    policy: [
      'Economic-nationalist trade and tariff posture.',
      'Administrative-state dismantlement framing.',
      'Hard immigration restriction.',
      'Confrontational posture toward U.S. media institutions.',
    ],
    moment:
      'His 2017 Time magazine cover with the headline "The Great Manipulator" captured his short but high-impact run as White House chief strategist.',
    links: {
      twitter: null,
      wikipedia: 'https://en.wikipedia.org/wiki/Steve_Bannon',
    },
  },
];

// Extended ranking pool — surfaced via the "Keep ranking" CTA on the
// results screen for politically-inclined voters who want to keep going
// past the headline 25. Sourced from research/nyt-2028-candidates.md
// (Reid Epstein's running NYT roundup). Same schema as CANDIDATES.
window.EXTENDED_CANDIDATES = [
  {
    id: 'pritzker',
    name: 'J.B. Pritzker',
    party: 'D',
    role: 'Governor of Illinois',
    born: '1965-01-19',
    resume: [
      'Governor of Illinois (2019–pres.)',
      'Founder, Pritzker Group venture capital (1996–2018)',
      'Member, Hyatt Hotels Corp. board (1985–2018)',
    ],
    hook: 'Billionaire governor putting his own money against red-state policy. Loud where Democrats have been polite — and willing to fund both sides of that bet.',
    bio_long:
      'J.B. Pritzker is an heir to the Hyatt hotel fortune and a venture investor who served on a string of Chicago civic boards before running for governor in 2018. ' +
      'He won re-election by 13 points in 2022 and has pushed a sweeping agenda — abortion-rights protections, an assault-weapons ban, and large state-funded child-care expansions. ' +
      'He has self-funded a national policy organization and visited every early primary state since 2024 without formally announcing a campaign.',
    storyline:
      'The donor-and-policy lane: a governor with personal wealth, executive record, and a willingness to throw punches at Republican governors on national TV.',
    policy: [
      'State-funded universal preschool and child-care expansion.',
      'Assault-weapons ban and high-capacity-magazine limits.',
      'Reproductive-rights shield laws for out-of-state patients.',
      'Manufacturing tax credits aimed at EVs and chips.',
    ],
    moment:
      'In 2024 he loaned his policy organization $10M to fund a counter-messaging operation against red-state abortion bans.',
    links: {
      twitter: 'https://twitter.com/GovPritzker',
      wikipedia: 'https://en.wikipedia.org/wiki/J._B._Pritzker',
    },
  },

  {
    id: 'sanders_sh',
    name: 'Sarah Huckabee Sanders',
    party: 'R',
    role: 'Governor of Arkansas',
    born: '1982-08-13',
    resume: [
      'Governor of Arkansas (2023–pres.)',
      'White House Press Secretary (2017–2019)',
      'Campaign manager, Mike Huckabee for President (2016)',
    ],
    hook: 'First woman governor of Arkansas. Framed the GOP as "normal" in a SOTU response at 40. Trump-era staff turning into Trump-era executives.',
    bio_long:
      'Sarah Huckabee Sanders is the daughter of former Arkansas governor Mike Huckabee and served as White House press secretary in Donald Trump\'s first administration. ' +
      'She was elected governor of Arkansas in 2022, becoming the first woman to hold the office, and signed sweeping education and tax-cut packages in her first term. ' +
      'She is widely seen as a likely 2028 contender or VP shortlist name, with strong donor and grassroots ties on both legs of the modern GOP.',
    storyline:
      'A bridge candidate between Trump-era staff and the next generation of Republican executives — and one of the few women in the field.',
    policy: [
      'Universal school-choice voucher program.',
      'Phaseout of state income tax.',
      'Restrictions on social-media use by minors.',
      'Abortion limits with narrow medical exceptions.',
    ],
    moment:
      'Her 2023 State of the Union response, delivered at age 40, framed the GOP as the party of "normal" against a "woke mob."',
    links: {
      twitter: 'https://twitter.com/SarahHuckabee',
      wikipedia: 'https://en.wikipedia.org/wiki/Sarah_Huckabee_Sanders',
    },
  },

  {
    id: 'abbott',
    name: 'Greg Abbott',
    party: 'R',
    role: 'Governor of Texas',
    born: '1957-11-13',
    resume: [
      'Governor of Texas (2015–pres.)',
      'Texas Attorney General (2003–2015)',
      'Justice, Texas Supreme Court (1996–2001)',
    ],
    hook: 'Bused migrants to Manhattan and changed the national immigration conversation. Three terms in, the question is whether he wants a fourth office or the biggest one.',
    bio_long:
      'Greg Abbott served as Texas attorney general for 12 years before winning the governor\'s office in 2014 and re-election in 2018 and 2022. ' +
      'His border-security initiative — including the Operation Lone Star deployment and migrant-busing program to northern cities — became the model for Republican governors across the country. ' +
      'He has signed major school-choice, abortion-restriction, and electric-grid legislation, and remained a fixture on the donor circuit even without a formal 2028 launch.',
    storyline:
      'The governor most identified with the immigration fight that defined the 2024 cycle. A run hinges on whether the field clears for him or stays crowded.',
    policy: [
      'Aggressive state-level border enforcement and migrant transport.',
      'Universal school-choice and parental-rights laws.',
      'Six-week abortion ban with narrow exceptions.',
      'Electric-grid hardening and ERCOT reform.',
    ],
    moment:
      'His 2022 deployment of state National Guard and DPS to the Texas-Mexico border under Operation Lone Star turned a state program into a national policy proxy.',
    links: {
      twitter: 'https://twitter.com/GregAbbott_TX',
      wikipedia: 'https://en.wikipedia.org/wiki/Greg_Abbott',
    },
  },

  {
    id: 'kemp',
    name: 'Brian Kemp',
    party: 'R',
    role: 'Governor of Georgia',
    born: '1963-11-02',
    resume: [
      'Governor of Georgia (2019–pres.)',
      'Georgia Secretary of State (2010–2018)',
      'Georgia State Senator (2003–2007)',
    ],
    hook: 'Told Trump no on 2020 and won the primary anyway. The Republican proof-of-concept for tolerating the boss without bending the knee.',
    bio_long:
      'Brian Kemp served as Georgia secretary of state before winning a narrow 2018 governor\'s race against Stacey Abrams. ' +
      'He resisted Donald Trump\'s pressure to overturn Georgia\'s 2020 election result, then crushed a Trump-backed primary challenge from David Perdue in 2022 and beat Abrams again in the general by seven points. ' +
      'Term-limited from another gubernatorial run, he has built a national profile through business-friendly governance and a brief 2028 PAC announcement in late 2025.',
    storyline:
      'A "Trump-tolerant" Republican executive who has won statewide twice without breaking the coalition — a model some donors badly want at the national level.',
    policy: [
      'State income-tax reduction and Georgia film-industry incentives.',
      'Public-safety hiring bonuses and prosecutorial-discretion limits.',
      'Heartbeat abortion ban with rape-and-incest exceptions.',
      'Election-integrity laws including absentee-ballot ID.',
    ],
    moment:
      'In 2020 he certified Joe Biden\'s narrow Georgia win despite a public Trump pressure campaign — and survived the 2022 primary backlash anyway.',
    links: {
      twitter: 'https://twitter.com/BrianKempGA',
      wikipedia: 'https://en.wikipedia.org/wiki/Brian_Kemp',
    },
  },

  {
    id: 'youngkin',
    name: 'Glenn Youngkin',
    party: 'R',
    role: 'Former Governor of Virginia',
    born: '1966-12-09',
    resume: [
      'Governor of Virginia (2022–2026)',
      'Co-CEO, The Carlyle Group (2018–2020)',
      'Carlyle Group executive (1995–2020)',
    ],
    hook: 'Private equity into a purple-state win, term-limited at 53. Gaffe-free, donor-ready — the kind of Republican the country club still wants.',
    bio_long:
      'Glenn Youngkin spent 25 years at the Carlyle Group, rising to co-CEO, before stepping down in 2020 to run for governor of Virginia. ' +
      'He won in 2021 by riding a parents-rights education message that ate into Democratic suburbs and ended the term-limited governorship as one of the most-watched Republican executives in the country. ' +
      'Virginia limits its governors to a single consecutive term, freeing him to weigh a 2028 run with a fresh donor list and minimal voting record to defend.',
    storyline:
      'A relatively gaffe-free private-equity-to-politics pitch with a recent statewide win in a purple state — donor-class catnip if the field is ready for it.',
    policy: [
      'Parental-rights laws and curriculum-transparency rules.',
      'Personal income-tax reductions and unemployment-tax cuts.',
      'Mental-health workforce investment and right-to-work defense.',
      'Energy-development support including small modular reactors.',
    ],
    moment:
      'His 2021 win flipped a Virginia that Joe Biden carried by 10 points the year before — one of the steepest one-cycle swings in modern Virginia history.',
    links: {
      twitter: 'https://twitter.com/GlennYoungkin',
      wikipedia: 'https://en.wikipedia.org/wiki/Glenn_Youngkin',
    },
  },

  {
    id: 'burgum',
    name: 'Doug Burgum',
    party: 'R',
    role: 'U.S. Secretary of the Interior',
    born: '1956-08-01',
    resume: [
      'U.S. Secretary of the Interior (2025–pres.)',
      'Governor of North Dakota (2016–2024)',
      'Founder/CEO, Great Plains Software (1983–2001)',
    ],
    hook: 'Microsoft money, North Dakota plainspoke. Now runs federal lands and energy permitting — the most underrated dark horse in the cabinet.',
    bio_long:
      'Doug Burgum built Great Plains Software, sold it to Microsoft for $1.1B in 2001, and became a Microsoft senior vice president before returning to North Dakota to serve as governor for two terms. ' +
      'He ran briefly in the 2024 Republican primary as a low-key economic-development candidate before withdrawing and endorsing Donald Trump. ' +
      'As Secretary of the Interior he has overseen expanded oil-and-gas leasing, critical-mineral permitting, and a sharp rollback of Biden-era public-lands rules.',
    storyline:
      'A Cabinet job at Interior is an unusual launchpad, but the energy-and-minerals lane is wide open and his donor network is real.',
    policy: [
      'Expanded oil, gas, and critical-mineral leasing on federal lands.',
      'Permitting reform for energy and infrastructure projects.',
      'Public-land use deregulation; reduced national-monument designations.',
      'Investment in U.S. uranium and nuclear-fuel supply chains.',
    ],
    moment:
      'In 2023 he qualified for the first GOP primary debate by accepting $1 contributions from individual donors at a steep marketing cost — a strategy widely copied since.',
    links: {
      twitter: 'https://twitter.com/DougBurgum',
      wikipedia: 'https://en.wikipedia.org/wiki/Doug_Burgum',
    },
  },

  {
    id: 'gabbard',
    name: 'Tulsi Gabbard',
    party: 'R',
    role: 'Director of National Intelligence',
    born: '1981-04-12',
    resume: [
      'Director of National Intelligence (2025–pres.)',
      'U.S. Representative, HI-2 (2013–2021)',
      'Army National Guard officer, Iraq deployment (2002–pres.)',
    ],
    hook: 'Switched parties, kept the anti-interventionism. Ended Kamala’s 2020 run on a debate stage — now runs every U.S. intelligence agency.',
    bio_long:
      'Tulsi Gabbard served four terms in the U.S. House from Hawaii as a Democrat, ran for the 2020 Democratic presidential nomination, and left the party in 2022 citing what she called its "elitist cabal." ' +
      'She endorsed Donald Trump in 2024 and joined the new administration as Director of National Intelligence after Senate confirmation in early 2025. ' +
      'She is an Army National Guard lieutenant colonel with two Iraq-era deployments, and remains an unconventional voice in the Republican coalition on foreign policy.',
    storyline:
      'A genuine crossover candidate — anti-interventionist, populist, and famous enough to draw attention but untethered from either party\'s establishment.',
    policy: [
      'Skepticism of overseas U.S. military intervention.',
      'Whistleblower and intelligence-community reform.',
      'Veterans\' healthcare investment and PTSD treatment access.',
      'First Amendment and free-speech-focused tech regulation.',
    ],
    moment:
      'In a 2019 Democratic debate she effectively ended Kamala Harris\'s presidential campaign by attacking her California prosecutorial record.',
    links: {
      twitter: 'https://twitter.com/TulsiGabbard',
      wikipedia: 'https://en.wikipedia.org/wiki/Tulsi_Gabbard',
    },
  },

  {
    id: 'paul',
    name: 'Rand Paul',
    party: 'R',
    role: 'U.S. Senator from Kentucky',
    born: '1963-01-07',
    resume: [
      'U.S. Senator from Kentucky (2011–pres.)',
      'Chair, Senate Homeland Security Committee (2025–pres.)',
      'Practicing ophthalmologist (1993–2010)',
    ],
    hook: 'The libertarian lane never wins a primary — but it sets the agenda anyway. Filibustered drones for 13 hours and made it cool.',
    bio_long:
      'Rand Paul is an ophthalmologist who entered the Senate in 2011 on a Tea Party wave and has held the seat through three elections. ' +
      'He ran for president in 2016 and has built a brand around opposition to mass surveillance, foreign intervention, and pandemic-era public-health restrictions. ' +
      'As chair of the Homeland Security and Governmental Affairs Committee he has driven investigations of intelligence-agency surveillance and Anthony Fauci\'s NIAID tenure.',
    storyline:
      'A long-running libertarian lane that\'s never won a Republican primary but consistently sets a slice of the policy agenda.',
    policy: [
      'Curbs on NSA mass-surveillance and FISA-court authorities.',
      'Skepticism of long-term U.S. foreign-military engagements.',
      'Federal-spending audits and budget-reduction bills.',
      'Civil-liberties protections, including criminal-justice reform.',
    ],
    moment:
      'His 2013 13-hour Senate floor filibuster over drone-strike authority went viral on Twitter and made him a libertarian-movement folk hero.',
    links: {
      twitter: 'https://twitter.com/RandPaul',
      wikipedia: 'https://en.wikipedia.org/wiki/Rand_Paul',
    },
  },

  {
    id: 'kelly',
    name: 'Mark Kelly',
    party: 'D',
    role: 'U.S. Senator from Arizona',
    born: '1964-02-21',
    resume: [
      'U.S. Senator from Arizona (2020–pres.)',
      'NASA astronaut, four shuttle missions (1996–2011)',
      'U.S. Navy combat pilot, Persian Gulf (1987–2011)',
    ],
    hook: 'Astronaut. Navy pilot. Husband to Gabby Giffords. Outruns the party in a swing state — exactly the résumé a careful Democratic donor draws on a napkin.',
    bio_long:
      'Mark Kelly is a retired U.S. Navy captain who flew four space shuttle missions before retiring from NASA in 2011 to care for his wife, former Rep. Gabby Giffords, after she was shot. ' +
      'He won the 2020 Arizona special Senate election and the 2022 general by clear margins, becoming one of the few Democrats to consistently outrun the party in a swing state. ' +
      'He was on Kamala Harris\'s 2024 VP shortlist and has kept an open national schedule since.',
    storyline:
      'A "boring strength" Democrat — military credibility, swing-state record, no major culture-war scars. The lane is open if 2028 wants safety.',
    policy: [
      'Background-check expansion and red-flag laws.',
      'Border-security investment paired with legal-immigration reform.',
      'Veterans\' healthcare expansion and burn-pit compensation.',
      'Semiconductor manufacturing investment and tech-industrial policy.',
    ],
    moment:
      'His 2020 Senate swearing-in came one day after the Jan. 6 Capitol riot — his arrival flipping the chamber to Democratic control.',
    links: {
      twitter: 'https://twitter.com/SenMarkKelly',
      wikipedia: 'https://en.wikipedia.org/wiki/Mark_Kelly_(astronaut)',
    },
  },

  {
    id: 'vanhollen',
    name: 'Chris Van Hollen',
    party: 'D',
    role: 'U.S. Senator from Maryland',
    born: '1959-01-10',
    resume: [
      'U.S. Senator from Maryland (2017–pres.)',
      'U.S. Representative, MD-8 (2003–2017)',
      'Chair, DCCC (2007–2011)',
    ],
    hook: 'Flew to El Salvador to drag back a wrongfully deported constituent. The Senate lifer suddenly in the news cycle.',
    bio_long:
      'Chris Van Hollen represented Maryland in the U.S. House for 14 years before winning a Senate seat in 2016. ' +
      'He chairs the Senate Foreign Relations Subcommittee on Western Hemisphere affairs and has been a vocal critic of the Trump administration\'s deportation operations in Central America. ' +
      'His March 2026 trip to El Salvador to demand the return of a wrongfully deported Maryland resident — and his confrontation with the Salvadoran government — drew national attention and an Iowa visit shortly afterward.',
    storyline:
      'A late-emerging lane: senior Senate Democrat with a foreign-policy resume and a viral confrontation that landed in the news cycle just as 2028 chatter began.',
    policy: [
      'Latin American sanctions and democracy programs.',
      'Federal anti-poverty programs and EITC expansion.',
      'Gun-violence prevention through purchase-licensing rules.',
      'Climate-investment legislation, including offshore wind for the Chesapeake.',
    ],
    moment:
      'In March 2026 he flew to El Salvador to publicly demand the return of a wrongfully deported Maryland constituent — generating days of national coverage.',
    links: {
      twitter: 'https://twitter.com/ChrisVanHollen',
      wikipedia: 'https://en.wikipedia.org/wiki/Chris_Van_Hollen',
    },
  },

  {
    id: 'smith_sa',
    name: 'Stephen A. Smith',
    party: 'D',
    role: 'ESPN host and commentator',
    born: '1967-10-14',
    resume: [
      'Host, ESPN First Take (2012–pres.)',
      'Host, The Stephen A. Smith Show podcast (2018–pres.)',
      'Sports columnist, Philadelphia Inquirer (1994–2008)',
    ],
    hook: 'Loudest microphone in sports media, increasingly aimed at the Democratic Party. Says he’ll run if the field stays empty — and the field is staying empty.',
    bio_long:
      'Stephen A. Smith hosts ESPN\'s flagship debate show First Take and has the largest individual platform in U.S. sports media. ' +
      'He has used his podcast and YouTube channel to comment increasingly on politics, including high-profile criticisms of the Biden 2024 campaign and the Democratic Party\'s working-class outreach. ' +
      'He has publicly entertained a presidential run multiple times in 2025 and 2026 without filing — a recurring pattern that the political class is starting to take seriously.',
    storyline:
      'A name-recognition long shot from outside politics. The 2028 cycle has rewarded media figures before; whether ESPN-to-the-Oval Office translates is the open question.',
    policy: [
      'Working-class economic messaging without ideological labels.',
      'Criminal-justice reform and second-chance hiring.',
      'Anti-establishment positioning toward both party bases.',
      'Federal-investment framing around small business and HBCU funding.',
    ],
    moment:
      'In a March 2026 podcast episode he said he would "seriously consider" a run if the Democratic field stayed empty by the spring of 2027 — the comment trended for two days.',
    links: {
      twitter: 'https://twitter.com/stephenasmith',
      wikipedia: 'https://en.wikipedia.org/wiki/Stephen_A._Smith',
    },
  },

  {
    id: 'trumpjr',
    name: 'Donald Trump Jr.',
    party: 'R',
    role: 'Executive Vice President, The Trump Organization',
    born: '1977-12-31',
    resume: [
      'Host, Triggered podcast (2022–pres.)',
      'Executive VP, The Trump Organization (2001–pres.)',
      'Trump campaign surrogate (2016, 2020, 2024)',
    ],
    hook: 'Picked Vance for his dad. Big platform, no office, no qualms. The dynasty play if the family decides one of them stays on the ballot.',
    bio_long:
      'Donald Trump Jr. has helped run the Trump Organization since the 2000s and emerged as one of his father\'s most active political surrogates during the 2016, 2020, and 2024 campaigns. ' +
      'He hosts the Triggered podcast, has a massive following on X, and has been credited with engineering the J.D. Vance VP pick in 2024. ' +
      'He has never sought elected office, but his speaking schedule has expanded steadily through 2025 and 2026, with several visits to early-primary states.',
    storyline:
      'A pure-base play if the Trump family decides one of them should stay on the ballot — the question is whether the broader GOP coalition wants that.',
    policy: [
      'Hardline immigration enforcement and border-wall completion.',
      'America-first trade and tariff posture.',
      'Aggressive cultural-grievance framing toward universities and media.',
      'Sport-shooting and Second Amendment expansion.',
    ],
    moment:
      'In summer 2024 he was widely credited with pushing his father toward selecting J.D. Vance over a more traditional running mate.',
    links: {
      twitter: 'https://twitter.com/DonaldJTrumpJr',
      wikipedia: 'https://en.wikipedia.org/wiki/Donald_Trump_Jr.',
    },
  },

  {
    id: 'emanuel',
    name: 'Rahm Emanuel',
    party: 'D',
    role: 'Former U.S. Ambassador to Japan',
    born: '1959-11-29',
    resume: [
      'U.S. Ambassador to Japan (2022–2025)',
      'Mayor of Chicago (2011–2019)',
      'White House Chief of Staff (2009–2010)',
    ],
    hook: 'Sharp-elbowed centrist on a "Democrats need to talk like normal people" tour. The argumentative comeback, op-ed by op-ed.',
    bio_long:
      'Rahm Emanuel served as a House Democratic Caucus chair, Barack Obama\'s first White House chief of staff, and two terms as mayor of Chicago. ' +
      'He spent the Biden administration as U.S. ambassador to Japan, leading the deepening U.S.-Japan-Korea trilateral and the Camp David summit framework. ' +
      'Since returning stateside in early 2025 he has been on a heavy speaking-and-op-ed schedule, including multiple Iowa visits and a flurry of "the Democrats need to talk like normal people" policy memos.',
    storyline:
      'The "centrist comeback" lane — a sharp-edged Democrat with executive credentials and a foreign-policy resume, betting the primary wants to argue.',
    policy: [
      'Pro-growth Democratic framing focused on small business and tax simplification.',
      'Japan-and-Korea-anchored Indo-Pacific strategy on China.',
      'Public-school accountability with charter-school expansion.',
      'Federal infrastructure investment with state-level performance metrics.',
    ],
    moment:
      'His handling of the 2023 Camp David summit between the U.S., Japan, and South Korea is widely cited as the highlight of his Tokyo tenure.',
    links: {
      twitter: 'https://twitter.com/RahmEmanuel',
      wikipedia: 'https://en.wikipedia.org/wiki/Rahm_Emanuel',
    },
  },

  {
    id: 'raimondo',
    name: 'Gina Raimondo',
    party: 'D',
    role: 'Former U.S. Secretary of Commerce',
    born: '1971-05-17',
    resume: [
      'U.S. Secretary of Commerce (2021–2025)',
      'Governor of Rhode Island (2015–2021)',
      'Co-founder, Point Judith Capital VC (2000–2010)',
    ],
    hook: 'Ran the CHIPS Act and turned "industrial policy" into a brand. Donor-class darling — primary voters have no idea who she is.',
    bio_long:
      'Gina Raimondo was a venture capitalist and Rhode Island state treasurer before winning the governorship in 2014, where she pushed a state-level free community-college program. ' +
      'As Joe Biden\'s commerce secretary she became the public face of the $52B CHIPS Act semiconductor program, sitting in on chip-fab announcements and managing China export-control disputes. ' +
      'She has kept a heavy national speaking schedule since leaving Commerce in 2025, with donor-class enthusiasm well ahead of public name recognition.',
    storyline:
      'A wonky industrial-policy lane that the donor class loves and primary voters have never heard of — testable, but not yet tested.',
    policy: [
      'Semiconductor and clean-energy industrial policy.',
      'China export controls and outbound-investment reviews.',
      'Workforce-training and apprenticeship investment.',
      'Free community-college and skill-credential funding.',
    ],
    moment:
      'Her March 2024 announcement of a $6.6B grant to TSMC for Arizona chip fabs was the largest single CHIPS Act award.',
    links: {
      twitter: 'https://twitter.com/GinaRaimondo',
      wikipedia: 'https://en.wikipedia.org/wiki/Gina_Raimondo',
    },
  },

  {
    id: 'landrieu',
    name: 'Mitch Landrieu',
    party: 'D',
    role: 'Former White House Senior Adviser for Infrastructure',
    born: '1960-08-16',
    resume: [
      'Senior Adviser, White House Infrastructure (2021–2024)',
      'Mayor of New Orleans (2010–2018)',
      'Lieutenant Governor of Louisiana (2004–2010)',
    ],
    hook: 'Took down four Confederate monuments and gave a speech that won the JFK Profile in Courage. Southern Democrat betting the party still has a Southern path.',
    bio_long:
      'Mitch Landrieu served two terms as mayor of New Orleans and rose to national prominence after his 2017 speech on the removal of Confederate monuments. ' +
      'He served as Joe Biden\'s senior adviser overseeing the rollout of the $1.2T bipartisan infrastructure law, traveling to all 50 states to publicize specific project awards. ' +
      'He published a book on his infrastructure tenure in late 2025 and has been making the rounds with state party committees ever since.',
    storyline:
      'A Southern-Democratic-comeback theory of the case — the open question is whether 2028 is the cycle that finally rewards it.',
    policy: [
      'Federal infrastructure investment paired with project-permitting reform.',
      'Civil-rights-anchored historical-monument and memorial framing.',
      'Public-safety funding with anti-violence community programs.',
      'Coastal-resilience investment and FEMA reform.',
    ],
    moment:
      'His 2017 speech as New Orleans mayor explaining the removal of four Confederate monuments was reprinted in full by major newspapers and won the JFK Profile in Courage Award.',
    links: {
      twitter: 'https://twitter.com/MitchLandrieu',
      wikipedia: 'https://en.wikipedia.org/wiki/Mitch_Landrieu',
    },
  },
];
