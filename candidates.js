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
    hook: 'The 38-year-old biotech founder who turned a 2024 primary run into the Ohio governorship.',
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
    hook: 'Newark’s former mayor running on a "radical love" message and a long criminal-justice record.',
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
    role: 'Former Governor of Florida',
    hook: 'Two-term Florida governor who reshaped the state on schools and immigration before a flat 2024 primary.',
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
    hook: 'The first openly gay cabinet secretary, building a 2028 case after running DOT through the infrastructure law.',
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
    hook: 'The Senate Banking chair selling a sunny, opportunity-zone version of Republican economic policy.',
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
    hook: 'The documentary producer who flipped Georgia blue and now chairs the Senate’s top investigative subcommittee.',
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
    role: 'Former U.S. Secretary of Health & Human Services',
    hook: 'Environmental lawyer turned HHS Secretary, with a vaccine-skeptic record and a Kennedy surname.',
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
    hook: 'Cost Plus Drugs founder and ex-Mavericks owner, a frequent flirt with a centrist independent run.',
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
    hook: 'Former Fox News host running The Tucker Carlson Network with a large podcast and X audience.',
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
    hook: 'House Republican leader turned New York governor — the first GOP win in Albany in two decades.',
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
    hook: 'Three-term Republican with a maverick streak on tech, oversight, and reproductive rights.',
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
    hook: 'Progressive caucus standard-bearer with the largest social-media platform in Congress.',
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
    hook: 'Hillbilly Elegy author turned Ohio senator turned vice president — Trump’s presumed heir.',
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
    role: 'Former Governor of California',
    hook: 'Two-term California governor with a national profile built on high-profile fights with Republican governors.',
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
    hook: 'The former congressman and brief AG nominee, now hosting a nightly populist-right cable show.',
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
    hook: 'Former teacher whose viral statehouse speeches on faith and public schools built a national following.',
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
    hook: 'Former Florida senator running U.S. foreign policy after the 2024 campaign promotion.',
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
    hook: 'The 2024 Democratic nominee and former VP — biggest name in the field, with the biggest open question.',
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
    hook: 'Army veteran and ex-Fox host running a controversial force-structure and recruiting overhaul at the Pentagon.',
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
    hook: 'Army-veteran governor and bestselling author quietly building a national profile from Annapolis.',
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
    hook: 'Three-term Texas senator, 2016 primary runner-up, and one of the chamber’s sharpest committee questioners.',
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
    hook: 'Pennsylvania governor with a bipartisan-budget brand and a 2024 VP shortlist near-miss.',
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
    hook: 'Outspoken Freedom Caucus member from northwest Georgia with a sustained MAGA-media platform.',
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
    hook: 'Senior Minnesota senator and 2020 primary alum, currently running for governor at home.',
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
    hook: 'Former White House chief strategist and architect of the populist-right media ecosystem.',
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
