// affiliate-seed-templates.js  (Playbook)
// Seeds affiliate_templates with the message library. Idempotent: wipes and reloads.
// Run manually after deploy (and after any library revision):
//   curl https://cute-cat-d9631c.netlify.app/.netlify/functions/affiliate-seed-templates
// Templates are DB rows after this - edit copy in the DB / page without redeploying.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(opts.headers || {}) }
  });
  return { ok: r.ok, status: r.status, text: await r.text() };
}

// segment, step, channel, day_offset (days from cadence start), subject, body
const T = [];
const add = (segment, step, channel, day, subject, body) =>
  T.push({ segment, step_number: step, channel, day_offset: day, subject, body, active: true });

// ============ NEW_NEVER (signed up recently, no clients yet) ============
add('new_never', 1, 'email', 0, 'Two ways to send us your first client (both take under a minute)',
`Hey {first_name},

Hope your week's going well! {consultant_name} here at ASAP. Your referral portal just went live, so I wanted to personally say welcome and make sure you've got everything you need, because I'd love to see you get your first client in soon.

There are two easy ways to send someone our way:

The fastest is a warm transfer. If you've got someone in front of you or on the phone with a credit problem, just call my direct line at {consultant_phone}, three way me in or hand them off, and I'll take it from there. We're here 8 to 5 Central, Monday through Friday. This one works so well because your client hears a friendly voice right away instead of waiting on a callback.

The other is your portal: {portal_link} Drop in their name, phone, and email, and here's my favorite tip: use the notes box. Tell me what they're trying to get approved for, their timeline, anything I should know. Got their credit report? You can upload it right there too. The more context you give me, the better their first call goes. Your portal also shows you every client's live status and your payouts, whenever you're curious.

And a few answers to the questions your clients will probably ask you: the consultation's completely free, and they get an exact quote before paying a dime. We only charge for the specific accounts we go after, no monthly fees ever, which honestly makes us one of the least expensive options out there and one of the fastest. Most people see first results inside 30 to 60 days, some in as little as two weeks. And if we get zero results, they get their money back, so you're never putting your name on a gamble.

Oh, and you get paid on every client who signs up and pays.

Any questions about the portal, or about how our program works? Just reply, it comes straight to me, and I'll get you an answer same day.

Glad you're with us,
{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 2, 'email', 4, 'The two-minute handoff that changes everything',
`Hey {first_name},

Hope business is treating you well! Wanted to share the single most useful thing I've learned in this job, because it'll directly affect how much this partnership pays you.

Here's the honest truth we see every month: two partners can send us the same number of referrals, same quality of people, and one sees most of them sign up while the other watches them disappear. It took us years to figure out why, and it turned out to be beautifully simple: it's the ten seconds where the client gets introduced to us.

Put yourself in their shoes for a second. They just got told no. They're embarrassed, maybe a little defensive, and a lot of them have been burned before by some company that took monthly fees and mailed form letters. So when they get a bare link with no context, their guard goes straight up.

Here's the handoff that works instead, three small parts, two minutes total:

Part one, the warm sentence (ten seconds). And I'll give you the honest version since you haven't sent anyone yet: "I found a team that specializes in exactly this. They've helped over 67,000 people in 13 years, they only charge for actual results, and the consultation's free. Want the link?" Every word of that is true and verifiable, and that's exactly why it works.

Part two, the context (sixty seconds). Warm transfer them to me at {consultant_phone} while the moment's hot, or submit them in your portal with notes: their goal, their deadline, how they're feeling about it. Scared? Burned before? Tell me. It turns my first call from a stranger's cold call into a conversation with a friend of yours, which is what it really is.

Part three, the nudge (ten seconds, two days later). A quick text: "Hey, did you connect with the ASAP team yet? You're gonna love them." You'd be amazed how many stalled referrals that one text brings back. Busy people need reminders, nervous people need reassurance, and that text is both.

That's it. That's the whole difference between referrals that vanish and referrals that thank you.

Warmly,
{consultant_name}
ASAP Credit & Financial Services

P.S. Reply with the situation you run into most, a declined loan, a deal that died over a score, and I'll write you a talk track for that exact moment. Happy to do it.`);

add('new_never', 3, 'call', 8, null,
`BEFORE DIALING: check the touch timeline, their email replies, and the Pipedrive follow-up notes on the card. LVM entries mean you have NOT actually spoken. Never open like a stranger if there is history.
- IF PRIOR CONTACT: reference it specifically and pick up that thread
- IF FIRST CONTACT: warm intro, "saw you're over at {company}, wanted to put a voice to the name"
- Their company and occupation are on the card, never ask what they do
- Ask how often they run into people with credit problems in their line of work
- Give the play for their world: lender = declined apps, realtor = pre-approval falls through, dealer = turned down at the desk, tax or insurance = clients who mention debt
- Remind them: warm transfer to your direct line converts best, portal with good notes is a close second
- Offer the talk track for their situation, and the "show me" case files if they haven't seen results yet
- Zero pressure close: "the first one's the hardest, after that it's muscle memory"`);

add('new_never', 4, 'sms', 12, null,
`Hey {first_name}, it's {consultant_name} with ASAP. Just checking in since your portal went live, any questions I can help with? And if anyone in your world catches a no because of credit, you can warm transfer them straight to me: {consultant_phone}. Happy to help! (Reply STOP to opt out)`);

add('new_never', 5, 'email', 18, 'Three collections, fourteen days, all gone (a story for you)',
`Hey {first_name},

Hope you're having a good week! I wanted to share a quick story, because it's the fastest way to show you what your name gets attached to when you send someone our way.

A client came to us with three collection accounts weighing down his file, three different companies. He'd already tried disputing on his own through the online forms, twice, and nothing moved. Totally understandable that he was discouraged. That's most people's experience, and it's why so many folks believe nothing can be done.

Here's what we did for him, and why it took fourteen days instead of forever.

First, we asked for proof instead of asking for attention. An online dispute basically says "I don't think this is right," an automated check runs, and it dies quietly. We went a different way: straight to all three companies, requesting the documentation the law requires them to keep, the original signed application, the complete payment ledger, proof their reporting was even compliant.

Then something interesting happened: silence. None of the three companies responded with the paperwork. We send over 100,000 dispute letters every month, so the companies on the other side know we follow through. And when a company can't produce the documents, the account can't stand. All three deleted.

Fourteen days later, his file was clean. Not "updated," not "resolved." Gone.

That's really our whole philosophy: we don't send hope, we ask for proof, and what can't be proven comes off. Thirteen years and 67,000+ clients later, it still amazes me how often that's all it takes.

Anyway, next time someone in your world gets a no: warm transfer them to me at {consultant_phone}, or your portal's always there: {portal_link}

Talk soon,
{consultant_name}
ASAP Credit & Financial Services

P.S. Want to see the actual letters from a case like this? Reply "show me" and I'll send you a real one. Seeing it firsthand makes referring feel a lot more natural.`);

add('new_never', 6, 'email', 30, 'How can we help you grow?',
`Hey {first_name},

Hope things are good on your end! Honest check-in, no agenda, and I'll keep it short on purpose.

You've been set up with us about a month now, and I'd genuinely rather hear the truth than silence: what's getting in the way?

Some partners tell us they haven't run into the right person yet. Some say bringing up credit feels awkward. Some just forgot the portal exists because life's busy. All completely normal, and all fixable.

Whatever yours is, reply and tell me, and I'll put something together for your exact situation. A word for word talk track for the moment you see most. A piece you can hand to clients. Real case files that show what we do. Or, if you've got someone in mind and the conversation feels weird, just three way them to me at {consultant_phone} and I'll do all the talking. You literally just dial.

We're here to make you look good. That only works if I know where you're stuck.

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('new_never', 7, 'call', 42, null,
`BEFORE DIALING: read the timeline, replies, call 1 outcome, Pipedrive notes (LVM = never actually spoke). This continues a relationship, it does not restart one.
- Reference what you learned in call 1 or from replies, specifically
- Never sent anyone: "totally normal, most partners take a couple months for the first one. What would make it easier?"
- Offer the done-for-you assist: they three way you in or text-intro, you run the whole conversation
- Growth interest: top partners earn over $10,000 a month, offer to map the path for their business (skip money talk if no payout on file)
- Log what you learn, it drives everything after`);

// ============ REFERRED_PENDING (sent referrals, none sold yet) ============
add('referred_pending', 1, 'email', 0, 'Thank you for who you sent (and one small idea)',
`Hey {first_name},

First things first: thank you for the {referred_deals} {referral_word} you've already sent our way. Most people who sign up as a partner never send anyone, so you're already doing the part that matters, and I genuinely appreciate it.

None of them has signed up yet, and I want you to hear this from me directly: that's normal, and it's almost always fixable. When a referral stalls, it's rarely about their need. Their credit problem didn't go anywhere. It's usually about how warm the introduction was, and what happened in the couple days after.

So here are two small ideas, take whichever feels natural:

For the folks you already sent: a quick text from you today works wonders. Something like "Hey, did you connect with the ASAP team yet? You're gonna love them." You'd be surprised how many people just needed that little nudge, they got busy, or they got nervous, and hearing from YOU reassures them in a way we never could.

For your next referral: one warm sentence before the link. "This team's helped over 67,000 people in 13 years, they only charge for actual results, and the consultation's free." That handles the two big fears, scam and cost, before they ever click. Or skip the link entirely and warm transfer them to me live at {consultant_phone}, honestly the smoothest option there is.

And if you'd like, I'm happy to have our team take another friendly run at the ones you sent. Reply with anything you remember about what they needed, and I'll make sure our next call is one worth answering.

You're closer than you think!

{consultant_name}
ASAP Credit & Financial Services

P.S. Curious what happens once someone does sign up? Reply "show me" and I'll send you a real case, the actual letters and the deletion that came back.`);

add('referred_pending', 2, 'sms', 7, null,
`Hey {first_name}, it's {consultant_name}! Quick idea: a friendly text to your referrals ("did you talk to the ASAP team yet?") usually gets them moving again. Want the exact wording? Just reply, happy to send it. (Reply STOP to opt out)`);

add('referred_pending', 3, 'call', 14, null,
`BEFORE DIALING: check timeline, replies, Pipedrive notes for prior conversations (LVM = never spoke). They sent {referred_deals} referrals, zero converted. They are trying and probably a little discouraged. Lead with gratitude, never guilt.
- Prior contact exists? Continue that thread, do not restart
- Ask what happened when they shared the link: in person? Text? How did the person react?
- Diagnose the handoff: cold link drop, or warm intro?
- Teach the upgrade: warm transfer to your direct line beats everything
- Offer to have our team re-attempt the stalled referrals TODAY with fresh energy
- Give the one-liner for their industry (card has company and occupation)`);

add('referred_pending', 4, 'email', 24, 'A tale of two referrals (this one made me think of yours)',
`Hey {first_name},

Hope you're doing well! Quick story, because it made me think about the {referred_deals} {referral_word} you've sent us.

Two clients got referred to us in the same week a while back. The first came in as just a name and a number, no intro, no context. When we called, we were a stranger from a company they'd never heard of, calling about the most personal topic in their life. They never picked up again, and I don't blame them one bit. I probably wouldn't have either.

The second came with a warm handoff. Her referrer told us she was trying to buy a home for her kids, nervous about her score, and had been let down by another company before. So our first call started with all of that, gently. Her first words were "I've been waiting to hear from you." She signed up the same day, and three weeks later her biggest negative account was deleted and she was in underwriting for the house.

Same team, same program. The ten second introduction was the whole difference.

I have a feeling your people may have gotten the first experience, and the fix costs one text per person: "Hey, did you connect with the ASAP team yet? You're gonna love them." If you send those today, reply and let me know, and I'll make sure we call each of them within the day, armed with whatever context you can share.

We can absolutely still win these, together.

{consultant_name}
ASAP Credit & Financial Services`);

add('referred_pending', 5, 'email', 36, 'Where are you stuck?',
`Hey {first_name},

Hope all's well! No lesson this month, just a question, and I'll keep it short.

What's the hardest part of this for you right now? Getting people to click the link? Knowing what to say? The people you sent going quiet on you?

Reply in one sentence and I'll send you something built for your exact situation: a talk track, the follow-up text script, or I'll simply have our team take another friendly swing at the folks you already sent. I read every reply myself.

You did the hard part already, you sent people. Let me help you get paid for it.

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('referred_pending', 6, 'call', 45, null,
`Conversion follow-through call. Check notes/timeline first (LVM = never spoke).
- Review which referrals are still open (card + Pipedrive)
- Report honestly what happened on our attempts, and what we try next
- Re-teach the system: one warm sentence, or better, warm transfer to your line
- Any referral converted since last touch? CELEBRATE it, congrats email is coming to them too`);

// ============ DORMANT (sold before, quiet 90+ days) ============
add('dormant', 1, 'email', 0, 'It has been a while, and that might be on us',
`Hey {first_name},

Hope you've been well! I was going through our partner list and realized your last client with us was back in {last_referral_month}. You've sent us {sold_clients} {client_word} over time, which I'm grateful for, and I didn't want the quiet since then to be because we dropped the ball somewhere.

So, honest question, no pitch attached: did something change on your end, or did we do something that made you pause? If it's the second one, I genuinely want to know, because I'll personally run it down.

A few things have gotten better since {last_referral_month}, in case they matter to your clients: Progress Reports now go out on a set schedule, so the people you refer are never left wondering. First results are coming back faster, most clients see movement inside 45 days. And your portal shows you where every client you ever sent stands, plus your payouts, any time you're curious.

Either way, it's genuinely good to reconnect. Reply any time, it comes straight to me and I read every one.

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('dormant', 2, 'sms', 4, null,
`Hey {first_name}, {consultant_name} from ASAP here. Sent you an email but texts are easier! You sent us {sold_clients} great {client_word} a while back and things went quiet on both sides. Anything we could be doing better? I'd honestly love to hear it. (Reply STOP to opt out)`);

add('dormant', 3, 'call', 10, null,
`THE important win-back conversation. Check notes first (LVM = never spoke). Listen 80 percent.
- Open with appreciation, specific: "{sold_clients} clients came through you"
- The real question: "What would make it a no-brainer to send the next one?"
- Listen for: bad client experience, payout confusion, role change, a competitor
- Bad experience? Get the client name, promise to personally run it down, then DO it
- Payout? Confirm their method on file, fix anything stale
- Give before leaving: Handoff Guide, case files, or a co-branded piece
- Remind them warm transfers to your direct line exist now`);

add('dormant', 4, 'email', 20, 'The foreclosure we almost did not win',
`Hey {first_name},

Hope things are going well over there! I wanted to share a case with you, start to finish, because it's one of my favorites, and honestly, one we weren't sure we'd win.

A client came to us with a foreclosure from a major national bank blocking any future mortgage. It was well documented, and he'd already disputed it once through another company and lost. Tough starting position, and I'll admit we knew it going in.

Round one, we asked for everything: the signed application, promissory note, closing disclosures, deed of trust, statements, the full payment ledger, default notices, proof of compliance with state foreclosure law. And here's the twist: the bank actually produced all of it. Usually something's missing, and one missing document means deletion. Not this time. That's usually where a case like this dies.

Round two, we read every single page. It took a while, that was a mountain of paper. But line by line, the cracks showed up: inconsistent payment reporting across statements, ledger discrepancies, a misspelled legal name, and a date mismatch between the default notice and the reporting timeline. We packaged every error and filed. The bank still said no.

Round three, we took the full case to all three bureaus, laid out the violations with the court precedents behind them, and asked for removal on provable inaccuracy. All three bureaus removed the foreclosure.

Just under 120 days from "this probably can't be done" to gone. Cases like that one are why I love this job.

Your people were always in good hands here, and they still are. Next one that comes up: warm transfer to {consultant_phone}, or {portal_link}

Talk soon,
{consultant_name}
ASAP Credit & Financial Services

P.S. If a client experience ever made you hesitate to send someone, reply and tell me about it. I'll pull the file personally and give you the straight story.`);

// ============ SLOWING (31 to 90 days since last sale) ============
add('slowing', 1, 'email', 0, 'Checking in on your people',
`Hey {first_name},

Hope business has been good to you! Your last client came through in {last_referral_month} and I wanted to check in, partner to partner.

First: your portal shows where every client you've sent us stands, live, any time. And if you've got a question about one of them that a status page can't answer, just reply, happy to talk it through.

Second, a small thing that genuinely helps referrals convert: the clients who sign up fastest are the ones told one sentence before they ever click. "They only charge for actual results, and the consultation's free." Ten seconds, and it turns skeptical into curious. Or skip the middle entirely and warm transfer them to me at {consultant_phone} while they're standing there, that one's my favorite.

Nothing needed from you, the door's just open. How's business on your end?

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('slowing', 2, 'sms', 10, null,
`Hey {first_name}, it's {consultant_name}! If anyone in your world caught a no this month because of credit, that's exactly our lane. Send them through your portal or warm transfer them to me at {consultant_phone} and I'll personally look after them. (Reply STOP to opt out)`);

add('slowing', 3, 'call', 21, null,
`Relationship maintenance plus one conversion idea. Check notes first (LVM = never spoke).
- Their business first, actually listen
- Any referrals that did NOT sign up? Offer to take another run at them
- Their numbers if useful: "{sold_clients} of your {referred_deals} referrals became clients, want to talk about the rest?"
- Offer the Handoff Guide if they never got it, and remind them the warm transfer line exists`);

// ============ PRODUCING (client in last 30 days) ============
add('producing', 1, 'email', 0, 'Your partner update (and a thank you)',
`Hey {first_name},

Hope you're having a great week! Quick partner update, then I'll get out of your hair.

You've sent {referred_deals} {referral_word} our way, and {sold_clients} of them became paying {client_word}, including your most recent in {last_referral_month}. Thank you, truly. A referral is trust, and we never take yours lightly.

Two things, always true: your portal shows where every one of your clients stands, live, plus your payouts. And if anything's making referrals harder than it should be, a payout question, a client experience that bugged you, a tool you wish existed, tell me. I'll fix what I can and be straight with you about what I can't.

That's it, no ask. Keep sending people who need to get approval ready, and we'll keep making you look good for it.

Gratefully,
{consultant_name}
ASAP Credit & Financial Services`);

// ============ PRODUCING_FIRST (very first client just sold) ============
add('producing_first', 1, 'email', 0, 'Congrats on your first client with us!',
`Hey {first_name},

Congratulations on your first client with us! Genuinely, this is worth celebrating. Most people who sign up as a partner never send anyone, so turning a referral into a signed client already puts you in rare company.

Here's what happens now: we get your client moving, and most people see first results inside 45 days. They'll get Progress Reports on a set schedule so they're never in the dark, and you can watch their progress in your portal any time. And you get paid: once your client completes their program payments, your payout goes out on the 15th of the following month.

How are you feeling about everything so far? If anything was confusing, or if there's anything we could've done better on this first one, reply and tell me, I read every one of these and I actually want to know.

And here's the fun part about first clients: the second one gets easier, because now when you say "I know this team, I've seen what they do," it's completely true. That sentence plus a warm transfer to {consultant_phone}, or your link, is the whole job: {portal_link}

Proud to have you as a partner!

{consultant_name}
ASAP Credit & Financial Services`);

// ============ COLD (signed up long ago, never sent) ============
add('cold', 1, 'email', 0, 'Just checking in',
`Hey {first_name},

Hope you're doing well! Just checking in, you set up a referral account with us a while back, and I wanted you to know it still works and we're still here.

No pitch, I'm genuinely curious how you've been and what happened on your end. Never ran into the right person? Forgot we existed? Were never quite sure what we actually do? All good answers, honestly.

The short version, in case it helps: when someone gets declined for a loan, a mortgage, a car, or an apartment because of their credit, our credit accelerator program gets them approval ready. We've done it for 67,000+ people across 13 years. The consultation's free, they only pay for the specific accounts we go after, no monthly fees, and most see first movement inside 45 days.

Two easy ways to send someone whenever the moment shows up: your portal at {portal_link}, or warm transfer them straight to me at {consultant_phone}, Monday to Friday, 8 to 5 Central.

Anything that would make referring easier for you? Reply and tell me, I read every one.

Warmly,
{consultant_name}
ASAP Credit & Financial Services

P.S. If you were ever unsure whether this stuff actually works, reply "show me" and I'll send a real case from our files, the letters we sent and the deletions that came back. It's pretty satisfying to see.`);

add('cold', 2, 'email', 30, 'The moment to remember us',
`Hey {first_name},

Hope things are good! One small idea for you, then I'm gone.

You don't need to go hunting for people with credit problems. You just need one sentence ready for the moment someone mentions one, and that moment happens more than you'd think. It sounds like: "I got turned down." "My score tanked." "We have to wait until my credit's better." "The bank said come back in a year."

Every one of those is someone quietly hoping somebody knows what to do. And you do!

Your line: "I know a team that fixes exactly that. They've helped over 67,000 people, they only charge for results, and the consult's free. Want me to connect you?"

Then either send your link, or even better, three way them to me right there at {consultant_phone}. We take the whole conversation from that point. You never explain disputes, you never chase paperwork. One introduction, and you get paid when they sign up.

That's honestly the whole job: {portal_link}

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('cold', 3, 'email', 60, 'What partners actually earn (real talk)',
`Hey {first_name},

Hope you're well! Real talk about the money today, since we've never actually discussed it.

Some of our top partners earn over $10,000 a month from referrals alone. That's the ceiling, not the average, but it's real, it's paid monthly, and the path there is way less complicated than you'd guess.

Our most active partners aren't marketers. No ads, no content, no funnels. They're lenders, realtors, dealers, tax pros, and insurance agents who made exactly one change: instead of turning away the people they couldn't help, they started routing them to us.

Think about what a decline usually is: a dead end. The client leaves disappointed, and the deal, the loan, the sale, goes with them. Our partners turned that same moment into a loop: the declined client comes to us, gets approval ready over 60 to 90 days, and comes BACK. The partner got paid on the referral, and then the original deal closes on the second try. Paid twice on a moment that used to be worth nothing.

That's the whole trick, and it's why the top of our board is full of regular professionals who simply stopped letting their declines walk away.

Your link still works whenever the next one shows up: {portal_link} Or warm transfer them to me live: {consultant_phone}

Warmly,
{consultant_name}
ASAP Credit & Financial Services

P.S. Reply with what you do for work and I'll send you the exact one-liner partners in your industry use. Two minutes for me, saves you the awkward part.`);

// ============ ROTATION (monthly value, every 3rd touch is a call) ============
add('rotation', 1, 'email', 30, 'How our process actually works (a real case, start to finish)',
`Hey {first_name},

Hope your month's going well! One of the questions we get most, from clients and partners alike, is "how does your process actually work?" Fair question, because what we do looks nothing like what most people picture. So let me answer it with a real case.

A client came to us with a charge-off on an auto loan. Two years old, dragging his score down, and blocking a business loan he really needed. He'd already disputed it online, twice, and nothing moved. He was pretty discouraged, and honestly, who wouldn't be?

Here's the thing about online disputes: you're locked into preset checkbox reasons, the bureau runs an automated check, the lender's computer says "confirmed," and it's over in days. Nobody ever actually looks at the account. It's convenient by design, and it quietly convinces people that nothing can be done.

So we went a different way. We reached out to the lender directly and requested the documentation federal law requires them to keep: the original signed agreement, the complete payment ledger, the signed application, proof their reporting met compliance standards.

The lender replied, but incompletely, missing key documents. And here's the part most people never learn: an account that can't be verified has to be deleted. That's the law. We filed on exactly those grounds, and the charge-off came off.

His score jumped, and the business loan closed. And the lender never pushed back, because they know the rules better than anyone. They just couldn't meet them this time.

That's our whole approach in one story: we ask for proof, and what can't be proven comes off. 67,000 clients later, it still works.

Got someone this would help? Warm transfer them to me at {consultant_phone} or send them through {portal_link}

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 2, 'email', 30, 'The CEO Method (late payments, gone in three weeks)',
`Hey {first_name},

Hope you're doing great! Today I want to show you one of the fastest tools we have, because if you ever refer someone whose only problem is late payments, this is what happens to their file.

We call it the CEO Method, and the name is literal.

C is Challenge. We open with a formal dispute asking for the documentation that proves the late payment is valid: the payment records, the statements, the notice history. Not a complaint, a request for proof.

E is Escalate, and this is the fun part. If the response comes back incomplete or wrong, and it often does, we don't send another letter into the same customer service pile. We take the file up to executive leadership, often the office of the CEO, with the compliance problems laid out clearly and respectfully. Executives read differently than call centers. They see risk, and they act on it.

O is Overturn. Faced with documented reporting problems on an executive's desk, companies usually take the sensible exit: internal review, quick removal.

Real case: a client came in with one misreported late payment costing him his mortgage pre-approval. Not a collection, not a charge-off, one late payment. Three weeks with the CEO Method and it was deleted, his score jumped 50+ points, and the mortgage went through.

A lot of people are told late payments are just something you wait out for seven years. It's one of my favorite myths to bust.

So next time someone says "it's just a couple late payments, probably not worth it," you'll know better. That person might be three weeks from approval: {portal_link}

Warmly,
{consultant_name}
ASAP Credit & Financial Services

P.S. Reply "guide" and I'll send you our CEO Method one-pager, good for your own reference or to hand a client.`);

add('rotation', 3, 'email', 30, 'The three mistakes that keep people stuck',
`Hey {first_name},

Hope all's well with you! Every week we meet people who are stuck, not because of what's on their report, but because of the advice they followed first. Usually well-meaning advice, from the internet, a bank teller, or an uncle.

Here are the big three, why each one backfires, and the sentence to listen for. Catch these in conversation and you'll spot referral moments everyone else misses.

Mistake one: paying off negative debt. It sounds responsible, but paying a collection doesn't remove it, the damage stays for years. And here's the cruel twist: paying can actually LOWER the score short-term, because it refreshes the "last activity" date and makes old damage look new. What we do instead is check the legal standing first. If the collector can't validate the debt with documentation, it doesn't get paid, it gets deleted.

The sentence to listen for: "I'm gonna pay off these collections and then apply." Gently stop them. Remember Diana? She almost paid $4,200 on a collection before her loan officer sent her to us. We asked the creditor for the paperwork, they couldn't produce the contract, it came off in 24 days, and she kept her $4,200 AND got her SBA loan.

Mistake two: debt consolidation. One payment, one rate, sounds tidy. In practice it often closes accounts, shrinks the average account age, drops the score, and costs more over time. And the negatives it "consolidates" are usually still sitting right there on the report.

The sentence: "I'm thinking about one of those consolidation programs." That person deserves a free second opinion before they sign anything.

Mistake three: disputing online. The bureaus made it convenient on purpose: preset checkboxes, automated verifications, done in days. Then the person concludes "I tried, nothing works" and gives up for good. Our disputes are custom-built and documentation-driven, which is a completely different conversation.

The sentence: "I already tried disputing, it didn't work." That's not the end of their story. It's usually where ours begins.

One sentence saves people from all three: "Before you do that, let me connect you with a team I trust. The consult's free." Then {portal_link}, or three way them to me at {consultant_phone}.

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 4, 'email', 30, 'A tale of two referrals (the ten seconds that decide everything)',
`Hey {first_name},

Hope your week's treating you well! Short story this month, because it carries the single most useful lesson in this whole partnership.

Two clients got referred to us in the same week. On paper they were identical: both needed to get approval ready, both sent by partners we like, both got the same team and the same process.

The first came in as a name and a phone number. No intro, no context. When we called, we were a stranger from an unknown company, calling about the most personal subject in their life. Second call, no answer. Third, same. That referral quietly died, and honestly, I understand why. In their shoes I might not have picked up either.

The second came with a warm handoff. Her referrer told us she was trying to buy a home for her kids, nervous about her score, and had been let down by another company before. So we opened with all of that, gently. Her first words: "I've been waiting to hear from you." Signed up same day. Three weeks later, her biggest negative account was deleted and she was in underwriting.

Same team, same program. Ten seconds of introduction was the entire difference between a dead lead and a changed life.

The whole lesson in three small moves: one warm sentence before the link. A little context in the portal notes (their goal, their deadline, how they're feeling), or better yet a live warm transfer to {consultant_phone}. And the two-day text: "Did you connect with the ASAP team yet? You're gonna love them."

That's it. That's the entire edge.

Warmly,
{consultant_name}
ASAP Credit & Financial Services

P.S. Next referral, try all three moves and then reply and tell me what happened. I keep score on these, and the pattern hasn't missed yet.`);

add('rotation', 5, 'email', 30, 'Where are you stuck?',
`Hey {first_name},

Hope you're doing well! No lesson this month, just a question, and I'll keep it short on purpose.

What's the hardest part of referring for you right now?

For some partners it's spotting the moment. For some it's bringing up credit without it feeling awkward. For some, their industry just doesn't surface these conversations much. And for some, honestly, it's that we haven't given them the right tools yet, which is on us, not them.

Whatever yours is, reply and tell me in one sentence. I'll send back something built for your exact situation: a talk track, a script for your team, a piece to hand clients, or the case files that show exactly what we do. I read and answer every reply myself.

We're here to make you look good. Help me do my job!

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 6, 'email', 30, 'Why I started this company (a note from our founder)',
`Hey {first_name},

Hope things are great on your end! Something a little different this month: the story behind the company you partner with, in our founder's own words. It's worth two minutes.

"I started ASAP in 2013 because I watched good people get treated like case numbers. They'd come in with reports full of accounts that were flat-out wrong, collections that weren't theirs, balances reported incorrectly, on-time payments marked late, and the standard answer everywhere was the same: mail a form letter and hope.

I couldn't accept that the burden of proof sat on the consumer. The law says the opposite. The law says the companies reporting this information have to be able to PROVE it, with documentation, and if they can't, it comes off. So we built our whole company on that one idea: stop hoping, start asking for proof.

Thirteen years later, that idea has served over 67,000 clients. We've removed more than 2.3 million inaccurate records. We send over 100,000 dispute letters a month. And we bill for results, not promises, because I never wanted to be one more company collecting a monthly fee while a family waits.

But here's the part that matters to you. The clients who change the most are almost never the ones who found us through an ad. They're the ones somebody SENT. Somebody they trusted said 'I know a team that can fix this,' and that trust is half the battle before we ever pick up the phone. That's why we take our partners so seriously. You're not a marketing channel to us. You're the reason a scared person answers the phone.

So thank you for being one of the people who sends them."

Joe Mahlow, Founder and CEO

If any of that raises a question, or you've got a story about someone you sent us, reply. We both read them.

Warmly,
{consultant_name}
ASAP Credit & Financial Services`);

add('rotation', 7, 'email', 30, 'What the top of the partner board looks like',
`Hey {first_name},

Hope you're having a good one! Every so often I like to share what our highest-earning partners actually do, because it's far less complicated than you'd expect, and that's genuinely good news.

The number first, so you know what's possible: our top partners earn over $10,000 a month from referrals. Not from ads, not from content. From conversations they were already having.

Here's everything they do differently. It's three things.

One: they mention us IN the decline conversation, not weeks later. The moment someone hears "no," they hear "and here's what you can do about it" in the same breath. People are most motivated to fix their credit in the exact moment it costs them something. A week later, embarrassment usually wins.

Two: the link travels WITH the recommendation. Not "I'll connect you later," because later rarely comes. Sentence and link, same text, while it's fresh. Or my personal favorite: "actually, hold on, let me get them on the phone right now" and a warm transfer to {consultant_phone}. Nothing beats that.

Three: the two-day text. "Did you connect with the ASAP team yet? You're gonna love them." Ten seconds, and it's the single highest-converting habit we've ever measured. It reminds the busy and reassures the nervous, both at once.

That's the whole playbook. No funnels, no scripts longer than a sentence, no budget. The top of our board is regular professionals who simply send the most people and hand them off warmly.

And the math is kind: every decline that used to be a dead end becomes a referral payout plus a future closed deal when they come back approval ready. The five-figure partners didn't find more leads. They just stopped letting their declines walk away.

Warmly,
{consultant_name}
ASAP Credit & Financial Services

P.S. Want to know what YOUR path to the top of the board looks like? Reply "map it" and I'll call you this week and we'll build it together. Real offer.`);

add('rotation_call', 1, 'call', 30, null,
`Monthly relationship call (every 3rd monthly touch is human, forever). No agenda, no pitch. Check notes FIRST (LVM = never actually spoke).
- Review the card: their numbers, industry, Pipedrive notes, replies
- Open warm and specific: reference something real (last client, their industry's season, a reply they sent)
- Ask how business is going, actually listen for referral moments in the answer
- One idea for their world: lenders = declined apps, realtors = failed pre-approvals, dealers = desk turndowns, tax = refund-season debt talk, insurance = rated-up clients
- Remind them the warm transfer line exists: your direct number, 8 to 5 Central weekdays
- Unconverted referrals? Offer a fresh team run at them this week
- Close: "anything you need from us? Talk track, case files, anything, I'll send it today"
- Log the outcome, it feeds every message after`);

exports.handler = async () => {
  try {
    const del = await supa('affiliate_templates?id=gt.0', { method: 'DELETE' });
    if (!del.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'wipe failed: ' + del.text.slice(0, 200) }) };
    let inserted = 0;
    for (let c = 0; c < T.length; c += 50) {
      const chunk = T.slice(c, c + 50);
      const ins = await supa('affiliate_templates', { method: 'POST', body: JSON.stringify(chunk) });
      if (!ins.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'insert failed: ' + ins.text.slice(0, 200), inserted }) };
      inserted += chunk.length;
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, templates: inserted }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e.message || e).slice(0, 300) }) };
  }
};
