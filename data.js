export const CATS={food:{label:'מזון',color:'#4E6B3E'},restaurants:{label:'מסעדות וקפה',color:'#A06A2E'},transport:{label:'תחבורה',color:'#3E5C84'},fuel:{label:'דלק',color:'#C2703D'},health:{label:'בריאות',color:'#3C7367'},fitness:{label:'כושר וספורט',color:'#4F9A86'},beauty:{label:'יופי וטיפוח',color:'#C77DA0'},clothing:{label:'ביגוד והנעלה',color:'#C25E8A'},shopping:{label:'קניות',color:'#9A4F66'},home:{label:'בית וריהוט',color:'#8A7B4F'},tech:{label:'טכנולוגיה',color:'#6857A0'},entertainment:{label:'בידור',color:'#A24B57'},travel:{label:'נסיעות וחופשות',color:'#3E8FB0'},kids:{label:'ילדים',color:'#D38B3A'},education:{label:'חינוך',color:'#4F6FB0'},pets:{label:'חיות מחמד',color:'#8B6F47'},gifts:{label:'מתנות',color:'#B0567A'},bills:{label:'חשבונות',color:'#5B5F6E'},insurance:{label:'ביטוח',color:'#7A6E8F'},fees:{label:'עמלות ובנק',color:'#6E6E6E'},income:{label:'הכנסה',color:'#2F4A39'},other:{label:'אחר',color:'#7C7568'}};
export const MHE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
export const CAT_RULES=[
  // ── ספציפיים קודמים ──
  [/יס.?פלאנט|yes.?planet|yesplanet|סינמה.?סיטי|cinema.?city|רב.?חן|גלובוס.?מקס|לב.?סינמה/i,'entertainment'],
  [/סופר.?פארם|super.?pharm|superpharm|ניו.?פארם|new.?pharm|גוד.?פארם/i,'health'],
  [/סופר.?גז|פז.?גז|אמיסרגז|אמישראגז|דורגז|supergas|amisragas/i,'bills'],
  [/מקס.?ברנר|max.?brenner/i,'restaurants'],
  [/מגה.?ספורט|mega.?sport|דקתלון|decathlon|ספורט.?דירקט|רשת.?הספורט/i,'shopping'],
  [/חניון|חניה|parking|פנגו|pango|סלופארק|cellopark/i,'transport'],
  // ── דלק ──
  [/(?:^|\s)פז|\bpaz\b|סונול|sonol|דלק\b|delek|דור.?אלון|dor.?alon|תחנת.?דלק|תדלוק|\bfuel\b|gasoline|\bסד\"ש\b|ten.?petrol/i,'fuel'],
  // ── כושר וספורט ──
  [/הולמס|holmes|גו.?אקטיב|go.?active|אנרגים|energym|\bicon\b|קאנטרי.?קלאב|country.?club|חדר.?כושר|כושר|\bgym\b|fitness|קרוספיט|crossfit|פילאטיס|pilates|\byoga\b|יוגה|סטודיו.?כושר|אולם.?ספורט|בריכה|בריכת.?שחיה/i,'fitness'],
  // ── בריאות ──
  [/פארם|pharm|מרקחת|מכבי|maccabi|כללית|clalit|מאוחדת|meuhedet|לאומית|leumit|קופת.?חולים|מרפאה|clinic|רופא|דוקטור|doctor|שיניים|dental|dentist|אופטיק|optic|optika|משקפיים|terem|(?:^|\s)טרם|פיזיו|physio|מעבדה|מעבדות|רפואי|רנטגן|\blab\b|אבחון|תרופ/i,'health'],
  // ── ביטוח ──
  [/הראל|harel|מנורה|menora|הפניקס|phoenix|איילון.?ביטוח|הכשרה.?ביטוח|מגדל.?ביטוח|כלל.?ביטוח|clal.?insur|ביטוח|insurance|פנסי|pension|קופת.?גמל|השתלמות|פוליסה/i,'insurance'],
  // ── חשבונות ──
  [/בזק|bezeq|פרטנר|partner|סלקום|cellcom|פלאפון|pelephone|הוט|\bhot\b|\byes\b|גולן.?טלקום|we4g|\b019\b|\b012\b|\b013\b|\b014\b|סטינג|חברת.?חשמל|חשמל|electric|מי.?אביבים|מקורות|תאגיד.?מים|חברת.?מים|ארנונה|עירייה|עיריית|מועצה.?אזורית|municipal|אינטרנט|internet|סיבים|כבלים|cable|הוראת.?קבע|ועד.?בית/i,'bills'],
  // ── תחבורה ──
  [/\bgett\b|(?:^|\s)גט|\bbolt\b|\buber\b|אובר|יאנגו|yango|רב.?קו|רב.?פס|אוטובוס|\bbus\b|רכבת|train|מונית|taxi|אגד(?!יר|ה)|egged|מטרופולין|סופרבוס|כביש.?6|נתיבי.?ישראל|דרך.?ארץ|מוסך|garage|צמיגים|טסט|רישוי/i,'transport'],
  // ── נסיעות וחופשות ──
  [/אל.?על|\bel.?al\b|טיסה|flight|מלון|\bhotel\b|booking\.?com|airbnb|expedia|איסתא|\bissta\b|אופיר.?טורס|השכרת.?רכב|car.?rental|\bhertz\b|\bavis\b|\bsixt\b|נתב.?ג|airport|צימר|tripadvisor|skyscanner|trivago|ויזה.?כניסה|דיוטי.?פרי|duty.?free|wizz|ryanair|טורס\b/i,'travel'],
  // ── טכנולוגיה ──
  [/spotify|ספוטיפיי|netflix|נטפליקס|\bapple\b|itunes|icloud|\bgoogle\b|google.?play|youtube|disney|\bhbo\b|amazon.?prime|prime.?video|microsoft|מיקרוסופט|office.?365|adobe|dropbox|chatgpt|openai|\bclaude\b|anthropic|midjourney|canva|figma|github|notion|\bmonday\b|playstation|\bpsn\b|xbox|\bsteam\b|nintendo|נינטנדו|\bksp\b|קיי.?אס.?פי|אייוורלד|iworld|ivory|אייבורי|מחשבים|computer|אלקטרוניק|gadget|לאסט.?פרייס|last.?price|app.?store/i,'tech'],
  // ── חינוך ──
  [/אוניברסיט|universit|מכלל|college|בית.?ספר|תיכון|שכר.?לימוד|tuition|\bקורס\b|\bcourse\b|סמינר|seminar|udemy|coursera|הרצאה|ספרי.?לימוד|חונכות|שיעור.?פרטי|בית.?ספר.?לנהיגה|מורה.?לנהיגה/i,'education'],
  // ── ילדים ──
  [/גן.?ילדים|פעוטון|מעון.?יום|צהרון|בייביסיטר|babysit|טיפת.?חלב|(?:^|\s)חוג|צעצוע|\btoys\b|toys.?r|שילב\b|מוצרי.?תינוק|עגלת.?תינוק|\bbaby\b|פו?טבול.?ילדים/i,'kids'],
  // ── חיות מחמד ──
  [/וטרינר|\bvet\b|חיות.?מחמד|פט.?שופ|pet.?shop|\bpetshop\b|אוכל.?לכלב|אוכל.?לחתול|\bdog\b|\bcat.?food\b|כלבו.?חיות|animal|דוקטור.?פט|פטקו|petco/i,'pets'],
  // ── מסעדות ──
  [/קפה|cafe|coffee|ארומה|aroma|ארקפה|arcaff|קופיקס|cofix|נספרסו|starbucks|\bgreg\b|רולדין|roladin|מאפה|מאפיית|bakery|בורקס|מסעד|restaurant|ביסטרו|bistro|\bpub\b|בורגר|burger|מקדונלד|mcdonald|\bkfc\b|דומינוס|domino|פיצה|pizza|סושי|sushi|שווארמה|פלאפל|חומוס|שניצל|המבורגר|וולט|\bwolt\b|תן.?ביס|10bis|גלידה|ice.?cream|גולדה|golda|אגדיר|agadir|מוזס|moses|גירף|giraffe|יפניקה|japanika|לנדוור|landwer|דונאט|donut|וופל|waffle|בראסרי|פטיסרי|בר\b.?מסעד/i,'restaurants'],
  // ── מזון ──
  [/שופרסל|shufersal|רמי.?לוי|rami.?levy|ויקטורי|victory|מגה\b|יוחננוף|yochananof|טיב.?טעם|tiv.?taam|אושר.?עד|osher.?ad|יינות.?ביתן|מחסני.?השוק|קינג.?סטור|am.?pm|סופר\b|supermarket|grocery|מעדני|מכולת|ירקן|קצביה|זול.?ובגדול|חצי.?חינם|שוק.?העיר|סטופ.?מרקט|יש.?חסד|יש.?בשכונה|מחלבה|פיצוחי/i,'food'],
  // ── יופי וטיפוח ──
  [/מספרה|מספרת|barber|קוסמטיק|cosmetic|מניקור|פדיקור|manicure|pedicure|sephora|ספורה|\bmac\b.?makeup|איפור|makeup|בושם|perfume|fragrance|\bspa\b|ספא|טיפוח|עיצוב.?שיער|לק.?ג'ל|הסרת.?שיער|אסתטיק/i,'beauty'],
  // ── ביגוד והנעלה ──
  [/קסטרו|castro|\bzara\b|זארה|h&m|\bfox\b|פוקס\b|רנואר|renuar|גולף\b|american.?eagle|\bnext\b|נקסט|\bgap\b|\bmango\b|מנגו|pull.?&?.?bear|terminal.?x|טרמינל|asos|shein|שיין|\bnike\b|נייקי|adidas|אדידס|\bpuma\b|פומה|reebok|crocs|נעלי|\bshoes\b|הנעלה|scoop|טופ.?טן|delta\b|דלתא|intima|אינטימה|בגדים|ביגוד/i,'clothing'],
  // ── בית וריהוט ──
  [/ikea|איקאה|הום.?סנטר|home.?center|\bace\b|אייס\b|רהיט|furniture|מזרון|mattress|כלי.?בית|urban\b|דורון|טמבור|tambour|צבע\b|ברזל\b|חומרי.?בניין|כלבו.?בית|שגב.?בית|home.?decor|ורדינון/i,'home'],
  // ── בידור ──
  [/סינמה|cinema|קולנוע|theater|תיאטרון|הצגה|מופע|הופעה|concert|כרטיסים|tickets|eventim|איוונטים|זאפה|zappa|בארבי|barby|היכל|אצטדיון|stadium|סופרלנד|superland|לונה.?פארק|luna.?park|פארק.?מים|מוזיאון|museum|באולינג|bowling|escape|חדר.?בריחה|פיינטבול|paintball|קרטינג|לופטקארט/i,'entertainment'],
  // ── מתנות ──
  [/מתנה|מתנות|\bgift\b|פרחים|flowers|זר.?פרחים|חנות.?מתנות|gift.?card|שובר.?מתנה/i,'gifts'],
  // ── עמלות ובנק ──
  [/עמלה|עמלת|דמי.?כרטיס|דמי.?ניהול|ריבית|bank.?fee|דמי.?חבר|הקצאת.?אשראי|דמי.?פעולה/i,'fees'],
  // ── קניות (כללי) ──
  [/amazon|\bebay\b|aliexpress|עליאקספרס|\bzap\b|wish\b|סטימצקי|steimatzky|צומת.?ספרים|ספרים\b|דיוטי|sephora|ניופארם|חנות\b|\bstore\b|\bshop\b|מולטיפל|רשת\b|kravitz|קרביץ|אופיס.?דיפו|office.?depot|מחסן\b|outlet|פנדורה|pandora|מגנוליה|magnolia|תכשיט|jewelry|שעונים/i,'shopping'],
];
export function autocat(m){for(const[re,c]of CAT_RULES)if(re.test(m))return c;return'other';}
