# Build Your Own Talking Computer
### A course for young builders: how Lucy Labs made a text-to-voice platform with Claude and an open-source model called Chatterbox

**How to use this script**

- There are 14 chapters. Each one is about 5 to 7 minutes when read aloud at a calm pace (about 900 to 1,100 words).
- **NARRATOR** lines are read aloud.
- Lines in `[ON SCREEN: ...]` tell the video editor what to show.
- Boxes that start with **"Type this to Claude"** are real prompts kids can copy.
- Every number in this course comes from building Lucy Labs (lucylabs.app) for real. Where a number is a rough guess, the script says so.

---

## A note for grown-ups (read before Chapter 1)

- **Claude needs a grown-up's account.** Claude's plans are for people 18 and over. A grown-up signs up, pays and sits beside the young builder. Claude Code, the part that builds apps, comes with the paid Pro and Max plans.
- **Real money is involved** in a few steps: renting GPUs, buying a domain and taking payments with Stripe. Every one of those accounts is opened by a grown-up, with a grown-up's card, and has a spending limit set first.
- **Voices belong to people.** In this course we only ever copy our own voice, or the voice of someone who has said "yes" out loud and in writing. Never a famous person, a teacher, a friend as a prank, or a voice from a YouTube video.
- **Passwords and keys** are typed by the grown-up into a secret file on the computer. They are never pasted into a chat and never put on GitHub.

---

## Chapter 1 — Meet the Talking Computer
*(about 6 minutes)*

`[ON SCREEN: A laptop. A text box says "Hello! I'm a computer and I can talk." A play button. Sound wave wiggles as a warm voice reads it.]`

**NARRATOR:**
Hi, builders! Today we're going to learn how to make a computer talk. Not a beepy robot voice. A real voice, with breaths and little laughs, that sounds like a person.

You type words in a box. You pick a voice. You press play. And the computer reads your words out loud in that voice. Grown-ups call this **text-to-speech**, or **TTS** for short. Text goes in, speech comes out.

We know this works, because a real team built exactly this. It's called **Lucy Labs**, and it lives on the internet at **lucylabs.app**. They built it with a helper called **Claude**, an AI you can talk to, and a free brain for voices called **Chatterbox**.

By the end of this course you will know:
- what a "model" is, and how people make one,
- what a GPU is, and why talking computers need one,
- what GitHub and Hugging Face are,
- how to teach a model a brand-new voice with a trick called LoRA,
- how to ask Claude, step by step, to build the whole thing with you,
- and how to put it on the internet so people can use it.

Ready? Let's start with the most important word in this whole course.

### What is a model?

`[ON SCREEN: A giant cookbook. Its pages fill with millions of tiny numbers.]`

**NARRATOR:**
A **model** is a giant recipe made of numbers.

Imagine a cookbook. But instead of "two eggs and a cup of flour", every line is just a number, like 0.37, or minus 1.2. And there aren't ten lines. There are **hundreds of millions** of them. The Chatterbox voice model has about **500 million** numbers inside it. If you read one number every second, without sleeping, it would take you **about sixteen years** to read them all.

When you give the model some words, the computer pushes those words through the recipe. It multiplies them by the numbers, adds them up, multiplies again, layer after layer, and out the other end comes... sound.

The numbers have a special name: **weights**. Remember that word, because we'll need it later. "Model weights" just means "the numbers in the recipe".

### How does a recipe of numbers learn?

`[ON SCREEN: A kid throwing a paper ball at a bin. Miss left. Miss right. In!]`

**NARRATOR:**
Here's the magic part. Nobody types those 500 million numbers in by hand. The model **learns** them, the same way you learn to throw a paper ball into a bin.

1. **Guess.** At the start, all the numbers are random. You ask the model to say "hello", and it makes a horrible crackly noise.
2. **Check.** You compare its noise with a real person saying "hello". The computer measures how wrong it was. That measurement is called the **loss**. A big loss means very wrong. A small loss means nearly right.
3. **Nudge.** The computer works out which way to wiggle every single number to make the loss a tiny bit smaller, and wiggles them all, just a little.

Then it does it again. And again. **Millions of times**, with millions of real recordings. Guess, check, nudge. Slowly the crackle turns into mumbling, and the mumbling turns into words, and one day the words sound like a person.

That's called **training**. When it's finished, you save all the numbers into one big file. That file *is* the model.

### Using a model is different from making one

`[ON SCREEN: Two pictures side by side. Left: a huge bakery with 100 ovens, labelled "Training". Right: one kid with one cupcake, labelled "Using".]`

**NARRATOR:**
Making a model is like building a huge bakery and inventing a recipe from scratch. It takes a lot of people, a lot of ovens and a lot of money.

**Using** a model is like baking one cupcake from a recipe someone already wrote. That's quick and cheap. Grown-ups call using a model **inference**. It's a fancy word that just means "the model is doing its job".

And here's the best news in this whole course. Some teams who build those giant bakeries **give their recipe away for free**. That means *you* can use it, and even change it a little. That's what Lucy Labs did with Chatterbox.

In the next chapter, we'll find out why some recipes are free and some are secret.

---

## Chapter 2 — Open Models and Closed Models
*(about 6 minutes)*

`[ON SCREEN: Two boxes. One is see-through with a big padlock opened, labelled "OPEN". The other is a black box with a padlock, labelled "CLOSED".]`

**NARRATOR:**
There are two kinds of models in the world: **open** ones and **closed** ones.

### Closed models: the secret recipe

A **closed model** is like a famous restaurant's secret sauce. You can buy the sauce. You can taste it. But you can never see the recipe, and you can't take it home and change it.

You use a closed model through the internet. You send your words to the company's computers, their computers do the work, and they send back the answer. You pay a little bit each time. Closed models include:
- **Claude**, made by a company called Anthropic,
- **ChatGPT**, made by OpenAI,
- **Gemini** and **Veo**, made by Google,
- **ElevenLabs**, a company that makes voices.

Closed models are often the very best at what they do, because big companies spend a lot of money on them. They're also easy: no setup, you just ask. But you have to follow their rules, pay their prices, and you can't look inside.

### Open models: the recipe anyone can read

An **open model** is like a recipe printed in a library book. Anyone can borrow it, cook it at home, and even add their own twist.

When people say a model is "open", they usually mean three things are shared with everyone:
1. **The code.** The instructions that tell the computer how to run the recipe. This is usually on **GitHub**.
2. **The weights.** The giant file of 500 million numbers. This is usually on **Hugging Face**.
3. **A licence.** A short page of rules that says what you're allowed to do.

### Licences: the rules of the recipe

`[ON SCREEN: Three cards. "MIT — do almost anything, keep our name on it." "Apache 2.0 — same, plus patent protection." "Non-commercial — learning only, no selling."]`

**NARRATOR:**
Every open model comes with a **licence**. It's like the rules on a library card.
- The **MIT licence** says: "Use it, change it, even sell things you make with it. Just keep our name and our licence note in your copy." **Chatterbox uses the MIT licence.** That's why Lucy Labs could build a business on it.
- The **Apache 2.0 licence** is very similar, with an extra promise about patents. Spotify's Basic Pitch, which we'll meet at the end, uses it.
- Some models are **open but not for selling**. You can learn and play with them, but not charge money. Always ask Claude to read the licence before you build a business on a model.

### So which is better?

**NARRATOR:**
Neither! They're different tools.

| | Closed model | Open model |
|---|---|---|
| Where it runs | The company's computers | **Your** computer, or a computer you rent |
| How you pay | A little each time you use it | You pay for the computer (the GPU) |
| Can you look inside? | No | Yes |
| Can you change it? | No | Yes, with tricks like LoRA |
| Setup | Easy | Harder, but Claude helps |

Lucy Labs uses **both**. It uses closed **Claude** to write the code, and closed **Veo** to make videos. And it uses open **Chatterbox** for voices, because Chatterbox let them teach it brand-new voices and own the result.

`[ON SCREEN: Claude's logo holding hands with an open box labelled "Chatterbox".]`

**NARRATOR:**
That's the big idea of this course: **a closed helper, Claude, helps you use an open model, Chatterbox.** Claude is your builder friend. Chatterbox is the voice brain you're building with.

One more thing. "Open" doesn't mean "anything goes". Open voice models are powerful, and powerful things need kindness rules. We'll learn those in Chapter 8.

---

## Chapter 3 — How Chatterbox Was Made
*(about 7 minutes)*

`[ON SCREEN: A friendly team in an office. A sign on the door says "Resemble AI".]`

**NARRATOR:**
Chatterbox was made by a company called **Resemble AI**. They work on voices all day. In 2025 they did something generous: they gave Chatterbox away as an open model, with the MIT licence.

Let's find out how they built it.

### Step 1: They didn't start from zero

`[ON SCREEN: LEGO bricks labelled "PyTorch", "Llama", "CosyVoice", "HiFi-GAN", snapping together into a robot.]`

**NARRATOR:**
Here's a secret about building models. **Almost nobody starts from an empty page.** Builders stand on the shoulders of other builders, by using code that other people already shared.

The Chatterbox team started with open pieces like these:
- **PyTorch.** A free toolbox, first made by Meta, that does the "guess, check, nudge" maths on a GPU. Almost every model you'll meet is built with it.
- **Llama.** A free model shape from Meta. Llama was built for *text*. Chatterbox borrowed its shape, about half a billion numbers, but trained it to understand *speech* instead.
- **CosyVoice.** An open voice project from Alibaba. Chatterbox borrowed its way of chopping speech into little "sound tokens", and its way of turning tokens back into sound.
- **HiFi-GAN.** An open piece of code that turns a picture of sound into a real sound wave you can hear.

They snapped these LEGO bricks together, changed them, and added their own new bricks. The Chatterbox page on GitHub thanks all of these projects by name. That's how sharing works: you say thank you.

### Step 2: They collected a mountain of voices

`[ON SCREEN: A mountain of headphones. A counter spins up to 500,000 hours.]`

**NARRATOR:**
To learn to talk, a model has to listen. A lot.

The Chatterbox team trained it on about **500,000 hours** of cleaned-up speech. That's half a million hours. If you listened to it all, day and night, without stopping, it would take you about **57 years**.

And "cleaned up" matters. Before training, every recording has to be:
- **cut** into short pieces, a few seconds each,
- **cleaned**, so there's no music or traffic noise behind the voice,
- and **written down**, word for word, so the model knows which words go with which sounds. That written-down text is called a **transcript**.

Cleaning data is a huge, boring, super-important job. Bad data makes a bad model, every time.

### Step 3: They built the parts of the brain

`[ON SCREEN: An assembly line with four stations: an ear, a word-to-sound-token machine, a painter, and a stamp.]`

**NARRATOR:**
Chatterbox has a few parts that work like an assembly line.

1. **The voice listener (the "voice encoder").** You give it a short clip of somebody talking, maybe 10 or 15 seconds. It listens and squishes "what this voice sounds like" into a short list of numbers. Think of it as a **voice fingerprint**. Deep or high, scratchy or smooth.

2. **T3, the word-to-sound-token machine.** This is the Llama-shaped part, the big brain. You give it your words, plus the voice fingerprint. It writes out **sound tokens**, one after another, like writing a sentence one word at a time. About 25 sound tokens make one second of speech. Each token is a code for a tiny slice of sound, like a LEGO brick of noise.

3. **S3Gen, the painter.** Sound tokens are just codes. S3Gen turns them into a **picture of sound** called a **spectrogram**: time goes across, high and low sounds go up and down, and loud parts glow brighter. Then a HiFi-GAN-style part turns that picture into a real wobbling sound wave. That's what your speakers play.

4. **Perth, the invisible stamp.** Last of all, Chatterbox hides a secret **watermark** in the sound. People can't hear it. But a computer can find it later and say "this voice was made by AI". It's a kindness feature, so people can't be fooled.

There's also a **feelings knob**, called **exaggeration**. Turn it down and the voice is calm and flat. Turn it up and it gets dramatic and excited. And the newer **Chatterbox Turbo** understands little tags like `[chuckle]` and `[sigh]`, so you can write a laugh into your sentence.

### Step 4: They trained it on lots of GPUs

**NARRATOR:**
Then came the big "guess, check, nudge" loop, over and over, through all 500,000 hours. That needs a special kind of computer chip called a **GPU**. Not one. Lots of them, running for days and days.

### Why is making a model so expensive?

`[ON SCREEN: A shopping receipt that gets longer and longer.]`

**NARRATOR:**
Let's add up the bill.
- **Data.** Collecting, cleaning and writing down half a million hours of speech takes people and computers a very long time.
- **GPUs.** One good GPU costs about one to four dollars **every hour** to rent. Training a big model can use many GPUs for weeks. Hours times GPUs times dollars gets big, fast.
- **Mistakes.** The first try almost never works. Teams train, listen, fix, and train again.
- **People.** Very clever people working for months.
- **Electricity.** GPUs are hungry, and get hot.

Resemble hasn't told everyone their exact bill. But when the Lucy Labs team asked about building even a *small* voice model from scratch, the rough answer was: about **$50,000 and 10,000 hours of clean audio**, and it still wouldn't be as good.

So here's what Lucy Labs did instead. They used Chatterbox for **free**, and only taught it a few new voices. That cost about **fifty cents** of GPU time per voice. Fifty thousand dollars, or fifty cents. That's the superpower of open models.

---

## Chapter 4 — What Is a GPU? (And Do I Need One?)
*(about 6 minutes)*

`[ON SCREEN: A kitchen. Four master chefs on one side. Thousands of tiny helpers with tiny knives on the other.]`

**NARRATOR:**
Every computer has a brain chip called a **CPU**. A CPU is like **four to twelve master chefs**. Each chef is super clever. They can cook anything, follow tricky recipes, and decide what to do next. But there aren't many of them.

A **GPU** is like **thousands of kitchen helpers**. Each helper is simple. They can only do one small job, like chopping one carrot. But there are *thousands* of them, and they all chop **at the same time**.

GPU stands for **Graphics Processing Unit**. It was first made for video games. To draw a game, the computer has to colour millions of tiny dots on the screen, 60 times every second. Each dot is a simple job, so thousands of helpers are perfect.

### Why does a voice model need a GPU?

`[ON SCREEN: A grid of numbers multiplied by another grid. Thousands of tiny helpers each doing one multiplication.]`

**NARRATOR:**
Remember: a model is a recipe of 500 million numbers. To make **one** sound token, the computer multiplies your words by most of those numbers. To make **one second** of speech, it does that about 25 times. That's **billions** of multiplications every second.

But each multiplication is easy. "0.37 times 1.2". A simple, carrot-chopping job. So:
- On a **CPU**, the master chefs do them a few at a time. A sentence could take ages.
- On a **GPU**, thousands of helpers do them all at once. The sentence comes out **faster than you can say it**.

And training, the guess, check and nudge loop, is even hungrier. You do those billions of multiplications **forwards**, then **backwards** to work out the nudges, millions of times. Without a GPU, training would take years.

### NVIDIA and CUDA

**NARRATOR:**
Most AI is built for one family of GPUs, made by a company called **NVIDIA**. NVIDIA GPUs speak a special language called **CUDA**. A lot of AI code, including a lot of the voice-training tools Lucy Labs used, expects CUDA.

When the Lucy Labs team started, they checked their own computers. The Mac had no NVIDIA GPU. The Windows PC only had a small built-in graphics chip. So for training, they had to **rent** an NVIDIA GPU over the internet. That's the next chapter.

### But wait... what about new Macs?

`[ON SCREEN: A shiny new MacBook Pro. A label says "M5 chip, 48 GB memory".]`

**NARRATOR:**
Here's some exciting news. New Macs have very powerful chips, like Apple's **M5** family. And some have lots of memory, like **48 gigabytes**.

Apple's chips have a clever trick called **unified memory**. On most computers, the CPU and GPU each have their own separate memory, like two kids with two lunchboxes. On a Mac, they **share one big lunchbox**. So a Mac with 48 gigabytes can fit a really big model into that shared memory, and its built-in GPU and special AI parts can run it.

That means a new Mac can do a lot **without renting a GPU**:
- **Running** many open models, like a voice model reading your sentence, or a chat model answering questions.
- **Small experiments**, like testing a voice clone with a 15-second clip.
- Apple even has a free toolbox called **MLX** made just for running models on Macs.

So why would you still rent a GPU?
- **Training** is far, far heavier than running. A rented NVIDIA GPU is usually much faster for it.
- **Lots of users at once.** If 100 people press play on your website at the same moment, your one Mac can't serve them all. Big GPUs in the cloud can.
- **CUDA-only code.** Some tools only work on NVIDIA GPUs.
- **Your Mac needs to be off sometimes!** A website has to work at 3 a.m. while you sleep.

**The simple rule:** play and learn on your Mac. Train and serve lots of people on a rented GPU.

Lucy Labs' own Mac was an older M1 with 16 gigabytes. It was fine for building the website and editing videos. But all the voice training happened on rented GPUs.

---

## Chapter 5 — Renting a GPU: Neoclouds, RunPod and Modal
*(about 6 minutes)*

`[ON SCREEN: A long street of warehouses. Each one is full of humming GPUs with blinking lights. A sign says "GPUs for rent, by the second".]`

**NARRATOR:**
GPUs are expensive to buy. A big AI one can cost as much as a car. So instead of buying one, you can **rent** one over the internet, just for the minutes you need it.

### What is "the cloud"?

**NARRATOR:**
"The cloud" sounds fluffy, but it just means **somebody else's computer, in a big building, that you use over the internet**. Those buildings are called **data centres**. They're full of computers stacked on shelves, with huge fans and air-conditioning to keep them cool.

### Why not just use AWS?

`[ON SCREEN: A giant supermarket labelled "AWS — 200 aisles". Next to it, a small shop labelled "GPU Shop — just GPUs".]`

**NARRATOR:**
The biggest cloud in the world is **AWS**, Amazon Web Services. Others include Google Cloud and Microsoft Azure. They're amazing. But they were built for a different main job.

AWS grew up running **websites, shops and databases** for big companies. Think of it as a giant supermarket with 200 aisles. It *does* sell GPUs, but:
- the GPUs are in aisle 147, behind lots of forms and settings,
- new accounts often have to **ask permission** to rent the big GPUs, and wait,
- the best GPUs are often **sold out**, or cheaper only if you promise to rent them for a year,
- and it's built for grown-up companies with teams of engineers.

So AWS is powerful enough. It's just not *built* for a kid, or a small team, who wants one GPU for 20 minutes right now.

### Neoclouds: GPU shops

**NARRATOR:**
That's why **neoclouds** were born. "Neo" means "new". A neocloud is a new kind of cloud that does mostly **one thing: rent GPUs**, simply, by the second. Examples are **RunPod**, **Modal**, **Lambda**, **CoreWeave** and **Vast.ai**. They stack thousands of GPUs in data centres and rent them out like scooters.

Lucy Labs used two of them, for two different jobs.

### RunPod: a GPU you can borrow like a desk

`[ON SCREEN: A desk with a GPU on it. A kid sits down. A timer says "$0.74 per hour".]`

**NARRATOR:**
**RunPod** lets you rent a whole computer with a GPU, called a **pod**. You log in to it from your Mac, like sitting at a desk in someone else's office.

Lucy Labs rented a pod with an **NVIDIA RTX 4090** GPU for about **74 cents an hour**. On it they:
- cleaned their voice recordings,
- tested Chatterbox,
- and trained their new voices.

Teaching the first two voices took about **2½ minutes of training each**. The pod was switched on for about 45 minutes for that whole step, and it cost about **55 cents**.

They also attached a **network volume**. That's like a locker that stays put when you leave your desk. They switched the pod off to stop paying, and their files stayed safe in the locker.

**Real lesson:** once they switched a pod off, its GPU got rented by someone else, and they couldn't get the same desk back! They just set up a new pod and opened the same locker. Claude helped them do that.

### Modal: a GPU that wakes up when someone presses play

`[ON SCREEN: A sleeping GPU in bed. A doorbell rings ("Play!"). It jumps up, talks, then yawns and goes back to sleep.]`

**NARRATOR:**
A website is different from training. People press play at random times. You don't want to pay for a GPU all night just in case.

**Modal** works like a GPU that **sleeps** until someone needs it. When someone presses play, Modal wakes up a GPU, runs Chatterbox, sends back the voice, and goes back to sleep. You only pay while it's awake.

Lucy Labs moved its voice website to Modal, because the first service they tried took 2 or 3 minutes to wake up. On Modal, waking up from deep sleep still took about **2 minutes**. But if someone had pressed play in the last 5 minutes, the GPU was still awake and answered in about **10 to 17 seconds**.

### The lights-left-on lesson

`[ON SCREEN: A house at night with every light on. A money meter spinning.]`

**NARRATOR:**
Here's a true story, and it's an important one.

Lucy Labs had a bit of code that **woke up the GPU every time anybody opened the homepage**, just to be ready. That sounded clever. But lots of visitors, and even robots that crawl the internet, opened the homepage. The GPU cost about **$1.95 an hour** and stayed awake for 5 minutes after each visit. So it was awake almost all the time, and the bill got big.

They fixed it with Claude: the GPU now only wakes up when a real person presses a real button.

**The lesson:** GPUs are like lights. **Turn them off when you leave the room.** Always ask Claude: "Is anything still running and costing money?"

---

## Chapter 6 — Your Toolbox
*(about 7 minutes)*

`[ON SCREEN: A toolbox opening. Inside: a Mac, the Claude app, a folder, a GitHub cat, a Hugging Face emoji, a padlock.]`

**NARRATOR:**
Let's pack your toolbox. Here's everything you need, and what each thing is for.

### Tool 1: A computer

**NARRATOR:**
A Mac is great. This course uses a Mac. A Windows computer works too. You don't need a fancy one for building the website. For running voice models at home, a newer Mac with lots of memory helps.

### Tool 2: A Claude subscription (with a grown-up)

`[ON SCREEN: claude.ai. A grown-up clicks "Sign up", then chooses the Pro plan.]`

**NARRATOR:**
Claude is the AI helper who will build with you. To use it for building apps, you need a **paid Claude plan**, like **Pro** or **Max**. Claude's plans are for grown-ups, so a grown-up signs up, pays, and builds alongside you. Think of it as a library card that a grown-up holds for the family.

### Tool 3: The Claude app, and the Code button

`[ON SCREEN: The Claude desktop app opening on a Mac. A big arrow points to the "Code" tab at the top of the window. Click! The screen changes to a folder picker.]`

**NARRATOR:**
Download the **Claude app** for your Mac from **claude.ai/download**, and sign in with the grown-up's account.

At the top of the app, you'll see a few tabs. One says **Chat**. That's for asking questions and chatting.

And one says **Code**. **That's the magic button.** It opens **Claude Code**.

What's the difference?
- In **Chat**, Claude can talk and explain things.
- In **Code**, Claude can actually **work on your computer**: make files, write code, install tools, run programs, open a little web browser to check its work, and save everything for you. It asks before doing anything big.

When you click **Code**, Claude asks you to **pick a folder**. That folder is Claude's workshop. Claude works inside it.

### Tool 4: A project folder on your Mac

`[ON SCREEN: Finder. Documents → New Folder → typing "my-talking-computer".]`

**NARRATOR:**
Open **Finder**, go to **Documents**, and make a new folder. Call it something like `my-talking-computer`. Then choose it when Claude Code asks for a folder.

Everything goes in there: the code, the website, and a folder for your voice recordings. Lucy Labs' folder is called **Sloane**. That was the project's secret code name before it was called Lucy. Real builders do that!

Inside, Claude will make:
- `web/` for the website,
- `scripts/` for the voice programs,
- `raw_audio/` for your recordings,
- a secret file called `.env.local` for passwords and keys. **This one never leaves your computer.**

### Tool 5: GitHub, the save-point library for code

`[ON SCREEN: github.com. A cute octocat. A timeline of save points: "added website", "added play button", "fixed bug".]`

**NARRATOR:**
**GitHub** is a website where people keep their code. It's like a **library**, plus **save points** in a video game.

Every time you finish something, Claude can make a **commit**. A commit is a save point with a little note, like "added the play button". If something breaks tomorrow, you can go back to yesterday's save point.

GitHub is also where **open-source code** lives. Chatterbox's code is on GitHub at **github.com/resemble-ai/chatterbox**. Anyone can read it.

And GitHub is how your website gets onto the internet, as you'll see in Chapter 10.

What you need: a free **GitHub account** (with a grown-up's help). Claude will ask you to sign in once, in your browser.

**Rule:** GitHub is for **code**. Not for big videos, not for voice recordings, and **never** for passwords. GitHub won't even take files bigger than 100 megabytes.

### Tool 6: Hugging Face, the library for model weights

`[ON SCREEN: huggingface.co. The 🤗 emoji. A shelf of model "books". One says "ResembleAI/chatterbox".]`

**NARRATOR:**
Remember **weights**, the giant file of 500 million numbers? That file is far too big for GitHub. So model makers put their weights on a different website called **Hugging Face**. Yes, it's named after the 🤗 emoji.

Hugging Face is like a **giant library of models**. There are hundreds of thousands of them: voice models, picture models, chat models, music models. Each model has a page that says what it does, how to use it, and what its licence is.

Chatterbox's weights live at **huggingface.co/ResembleAI/chatterbox**. When your code runs Chatterbox for the first time, it **downloads** the weights from Hugging Face automatically. That's a few gigabytes, so the first time is slow.

Hugging Face also stores **datasets** (big piles of training data) and lets you try models in your browser.

What you need: a free Hugging Face account. Some models make you click "agree" to their rules first.

### Tool 7: The secret file and the padlock rule

`[ON SCREEN: A treasure chest labelled ".env.local" with a padlock. A big red line stops it going to GitHub.]`

**NARRATOR:**
Websites like RunPod, Modal and Stripe give you **keys**: long secret codes that prove it's you. A key is like a house key. Whoever has it can get in, and can spend your money.

So:
1. A **grown-up** copies the key from the website.
2. The grown-up pastes it into the secret file, `.env.local`, on your computer.
3. Claude makes sure that file is on the **"never upload" list**. That list is called `.gitignore`.

**Never** paste a key into a chat. **Never** put a key on GitHub. If a key ever leaks, a grown-up should switch it off straight away and make a new one.

### The full shopping list

| Thing | What it's for | Free? |
|---|---|---|
| Mac (or PC) | Your workshop | You have it |
| Claude Pro or Max plan, and the Claude app | Your builder friend; the **Code** tab | Paid, grown-up's account |
| A project folder | Claude's workshop | Free |
| GitHub | Code library and save points | Free |
| Hugging Face | Download model weights | Free |
| RunPod or Modal | Renting a GPU | Pay by the second |
| Vercel | Putting your website on the internet | Free to start |
| A domain (e.g. from GoDaddy) | Your website's name | About $15–30 a year |
| Stripe | Taking payments | Takes a small slice of each sale |

Prices change, so ask Claude to check today's prices for you.

---

## Chapter 7 — How to Talk to Claude
*(about 7 minutes)*

`[ON SCREEN: The Claude app, Code tab. A blinking cursor in the message box.]`

**NARRATOR:**
Claude is very clever, but it can't read your mind. The words you type are called a **prompt**. A good prompt is like good directions to a friend's house. Let's learn the **seven golden rules**.

### Rule 1: Say your dream

Tell Claude **what** you want, **who** it's for, and **why**.

> **Type this to Claude:**
> I want to build a website where you type words, pick a voice, and it reads them out loud. It's for kids who want stories read to them. I want to use the free open-source model Chatterbox by Resemble AI.

### Rule 2: Say your limits

Tell Claude the rules: money, time, and what it must never do.

> **Type this to Claude:**
> Rules: please keep it super simple. Don't spend any money without asking me first. Tell me the price before you rent anything. Never put secret keys on GitHub. Only use voices of people who said yes.

### Rule 3: Ask for a plan first

Don't let Claude rush. Ask it to plan, and explain the plan simply.

> **Type this to Claude:**
> Before you build anything, make a step-by-step plan. Explain each step like I'm 8 years old. Tell me which steps need a grown-up, an account, or money.

### Rule 4: One step at a time

Big jobs go wrong. Small jobs go right.

> **Type this to Claude:**
> Let's do step 1 only. When it works, show me, then stop and wait for me.

### Rule 5: Make Claude show you the proof

Don't just trust "Done!". Ask to see, hear or click it.

> **Type this to Claude:**
> Play me the sound you made. Open the website in your browser and take a screenshot. Did it actually work?

### Rule 6: When something breaks, copy the error

Errors are just clues. Copy the red writing and give it to Claude.

> **Type this to Claude:**
> I got this error when I pressed play: (paste the red writing here). What does it mean, and can you fix it?

### Rule 7: Ask "why?" all the time

You're here to learn, not just to get a website.

> **Type this to Claude:**
> Why did you do it that way? What does this file do? What would happen if I changed this number?

### What happens when you press Enter

`[ON SCREEN: Claude Code working. Little cards appear: "Reading files...", "Writing web/page.tsx", "Running: npm install", a permission box: "Allow Claude to run this command?"]`

**NARRATOR:**
When you send a prompt in the **Code** tab, you'll see Claude **work**. It reads files, writes code, and runs commands in a little window called the **Terminal**. The Terminal is a text window where you type commands to the computer instead of clicking.

Sometimes Claude will stop and ask: **"Can I run this?"** Read what it wants to do. If it's installing a tool or saving a file, that's normal. If it wants to **spend money, delete things, or send anything to anyone**, get your grown-up.

Claude might also ask **you** questions, like "Do you want a dark or light website?" There are no wrong answers. It's your project.

### Bonus: tell Claude about you

**NARRATOR:**
You can teach Claude your style once, and it remembers.

> **Type this to Claude:**
> Remember: I'm a beginner. Always explain things simply. Always ask before spending money. Always save my work to GitHub when we finish something.

The Lucy Labs builder did exactly this. Their rules included "keep it super simple", "update GitHub after every piece of work", and "only use free credits when testing". Claude followed those rules for months.

### Prompts that DON'T work well

| Not great | Better |
|---|---|
| "make a voice app" | "make a website where you type words and a voice reads them, using Chatterbox" |
| "fix it" | "pressing play shows this error: ... can you fix it and show me it working?" |
| "do everything" | "make a plan first, then do step 1 only" |
| "make it better" | "the voice sounds robotic. What could make it sound more natural?" |

---

## Chapter 8 — Voices: Recording, Uploading and Being Kind
*(about 7 minutes)*

`[ON SCREEN: A kid in a cosy bedroom with curtains, holding a phone. A sign on the door: "Quiet please! Recording!"]`

**NARRATOR:**
Now for the fun part: voices! There are two ways to get a voice into Chatterbox.

### Way 1: The quick way. Upload a 15-second clip

**NARRATOR:**
Chatterbox can copy a voice from a **short recording**, without any training. This is called **zero-shot voice cloning**. "Zero-shot" means "zero practice". The model has never heard this voice before, but it has a go anyway.

Here's how it works:
1. You upload a short clip, about **15 seconds** is great to start with.
2. The **voice listener** turns it into a **voice fingerprint**.
3. **T3** and **S3Gen** speak your typed words, using that fingerprint.

Lucy Labs' very first test used one clip of about **14 to 15 seconds** per voice. It worked! The voices sounded like the right people.

But the team said they sounded "robotic". They had no Australian accent, the wrong speed and no personality. That's normal. A 15-second clip can teach **what a voice sounds like**, but not **how a person talks**: their accent, their pauses, their jokes.

Later, Lucy Labs found that **60 to 120 seconds** of lively talking holds a voice much better than 15 seconds. So 15 seconds to start, a minute or two for great.

### How to record a great voice clip

`[ON SCREEN: A checklist that ticks itself off.]`

**NARRATOR:**
The recording **is** the voice. Flat in, flat out. So:
- ✅ **A quiet, soft room.** A bedroom with curtains, or next to a wardrobe full of clothes. Not a bathroom or kitchen, because they echo.
- ✅ **Turn off** fans, air-conditioning and the TV.
- ✅ **Phone 15 to 25 centimetres** from your mouth. About the length of a pencil. Keep it there.
- ✅ **One voice only.** No music, no friends talking in the background.
- ✅ **Act, don't read!** Tell a story. Laugh. Ask a question. Whisper one line, say one line louder. Keep your "um"s. They make it sound like you.
- ✅ **Leave 1 to 2 seconds of silence** at the start.
- ❌ No "voice enhance" or noise filters. They rub out the breaths that make a voice sound human.

Here's a little story you could perform:

> "So I have to tell you what happened this morning. Um, I get to school, and the door's just... open. Nobody there! *(laugh)* And then my friend walks in holding two hot chocolates like nothing's wrong. *(quietly)* Honestly? I don't even want to know. *(brighter)* Anyway, good news, we won the game!"

### Way 2: The big way. Teaching from lots of audio

**NARRATOR:**
To get the accent, the pauses and the personality, you **teach** the model with **lots** of recordings of one person. That's called **fine-tuning**, and we'll learn the trick for it, LoRA, in the next chapter.

Lucy Labs started with **videos**: real lessons from an art teacher and a music teacher, who had agreed to it. Here's exactly what they did with those videos.

### Where do the raw videos go?

`[ON SCREEN: A conveyor belt: Video → Sound → Clean voice → Little clips with words → Locker on the GPU.]`

**NARRATOR:**
1. **Put the videos in your project folder** on your Mac, in a folder like `raw_videos/`. The **originals stay on your computer**. Videos are huge, so they **never go to GitHub**.
2. **Take the sound out.** Claude uses a free tool called **ffmpeg** to pull just the sound from each video. Lucy Labs got about **95 minutes** of the art teacher and **47 minutes** of the music teacher. Sound files are much smaller than video files.
3. **Upload the sound to the GPU's locker.** That's the **network volume** on RunPod, or a **volume** on Modal. It's private storage that sits right next to the GPU. Claude can copy the files there for you.
4. **Clean the voice.** On the GPU, a free model from Meta called **Demucs** separates the voice from any music or noise. You'll learn how Demucs works in Chapter 13!
5. **Chop and write down.** A free speech-to-text model called **Whisper** listens to the clean voice, cuts it into little clips **2 to 15 seconds long**, and writes down every word. Lucy Labs ended up with **712 clips (47½ minutes)** of the art teacher and **390 clips (36½ minutes)** of the music teacher.
6. **Make a list.** One file lists every clip and its words, like: `clip_00042.wav | Find the note you're comfortable singing.` That list is what training reads.

You might wonder about Hugging Face. You *can* keep a dataset there, but it must be set to **private**, and only if everyone in it said yes. Lucy Labs kept its voice data in its private GPU locker instead.

### The kindness rules (the most important part)

`[ON SCREEN: A big friendly shield. "Ask first."]`

**NARRATOR:**
A voice belongs to a person, just like their face or their name. Copying someone's voice without asking is **not okay**. It can be used to trick people, like pretending to be someone's mum on the phone.

So, every time:
1. **Only your own voice, or someone who said YES**, in writing, and knows what it's for.
2. **Never** famous people, never teachers or friends as a prank, never a voice from a YouTube video.
3. **Watermark everything.** Chatterbox's Perth stamp does this for you.
4. On a public website, **make people prove it's their voice**. Lucy Labs planned for people to read a **random sentence** out loud, live, and then checked that it matched the uploaded voice. Then nobody can upload someone else's recording.

Lucy Labs even made a rule in its code: no training a voice unless there's a **consent file**, a signed "yes", sitting next to the recordings.

> **Type this to Claude:**
> Add a checkbox that says "This is my voice, or I have written permission." Don't let anyone upload without ticking it. Save who ticked it and when.

---

## Chapter 9 — LoRA: Sticky Notes for Your Model
*(about 7 minutes)*

`[ON SCREEN: A huge, heavy encyclopedia. A kid adds a few colourful sticky notes to its pages.]`

**NARRATOR:**
Imagine Chatterbox is a giant encyclopedia about talking. It's 500 million numbers thick. You want it to learn **one new thing**: how *your* voice talks.

You could rewrite the whole encyclopedia. That's called **full fine-tuning**. It's slow and expensive, and you might accidentally rub out good stuff it already knew.

Or... you could add a few **sticky notes**.

That's **LoRA**. It stands for **Low-Rank Adaptation**. Big words, simple idea:
- **Freeze** the big model. Don't change any of its 500 million numbers.
- **Add tiny sticky notes** next to some of its pages. Each note has a few small lists of numbers.
- **Only train the sticky notes.**

When the model runs, it reads each page **plus** the sticky note, and the notes gently nudge it towards your voice.

### Why "low-rank"? (For curious kids)

`[ON SCREEN: A big square of numbers, 1000 by 1000. Then two skinny strips, 1000 by 32 and 32 by 1000, multiplying together to make a big square.]`

**NARRATOR:**
Inside the model, many pages are big **grids** of numbers, say 1,000 rows by 1,000 columns. That's a million numbers in one grid.

A LoRA sticky note doesn't add a whole new million-number grid. It adds **two skinny strips**: one that's 1,000 by 32, and one that's 32 by 1,000. When you multiply the two strips together, they make a full-size 1,000-by-1,000 change! But the strips only have **64,000 numbers**. That's about **15 times smaller**.

The **32** is called the **rank**, or **r**. A small rank means small, simple notes. A big rank means big, detailed notes.

### Where do the notes go?

**NARRATOR:**
In Chatterbox, Lucy Labs put sticky notes on the **attention** parts of the T3 brain. **Attention** is how the model decides **which earlier words and sounds to look at** while it makes the next sound token. Like when you read "the cat sat on the..." and your brain looks back at "cat" to guess "mat".

Notes on attention are perfect for voice, because so much of *how* a person talks is about timing, what they stress, and where they pause.

### How Lucy Labs trained a LoRA

`[ON SCREEN: A RunPod terminal. A progress bar fills. "Epoch 1/3... 2/3... 3/3. Saved: voice_lora.safetensors".]`

**NARRATOR:**
They started with a free, open-source training kit on GitHub called **chatterbox-finetuning**. Someone else had already written the hard code! Then:
1. Fed it the **list of clips and words** from Chapter 8.
2. Rented an RTX 4090 GPU on RunPod.
3. Trained the sticky notes. An **epoch** means "reading every clip once". The model reads all the clips a few times.
4. Saved the notes as a small file.
5. **Listened, and compared.**

The first two voices took about **2½ minutes** of training each.

### The big mistake, and what they learned

**NARRATOR:**
Here's an honest story. Their first LoRAs were **too big** and trained **too long**. The settings were rank 128 and 10 epochs, and they also retrained other big parts of the model. The voices learned to sound like **one flat podcast**. They were very "samey", and they couldn't laugh or get excited.

So they fixed the recipe:
- **Smaller notes:** rank **32** instead of 128.
- **Fewer reads:** **3 epochs** instead of 10.
- **Gentler nudges:** a smaller **learning rate**. That's how big each nudge is.
- **Notes only on attention,** and the rest of the model left alone.
- **Keep the "um"s** in the written-down words, so the model learns real people hesitate.
- **Better data:** at least **30 to 60 minutes** of **lively, acted** speech from one person. Laughs, questions, whispers.
- And a **blind test**: listen to the LoRA voice and the 15-second zero-shot voice without knowing which is which, and only keep the LoRA if it wins.

**The lesson:** sticky notes should **nudge**, not shout. Too much training makes a model forget what it knew. That's called **overfitting**, like memorising one page of a test instead of learning the subject.

### Lots of voices, one brain

`[ON SCREEN: One big brain. 17 tiny sticky notes around it, each with a name.]`

**NARRATOR:**
Because LoRA notes are small, you can keep **lots** of them and swap them in and out of **one** big model. Lucy Labs had about **17 voice LoRAs** sharing one Chatterbox brain on Modal.

### Is a LoRA "code"?

**NARRATOR:**
People sometimes say LoRAs are "little pieces of code you add to the model". That's close, but not quite. A LoRA is a **little file of numbers**, a mini set of weights. A small piece of **code** loads it and adds it to the big model.

And there are other little ways to tweak a voice **without any training at all**. They're just settings in the code:
- **Exaggeration:** the feelings knob. Low is calm, high is dramatic.
- **CFG weight:** how closely the voice follows the reference recording. Lower can sound more relaxed and natural.
- **Tags** in Chatterbox Turbo: write `[chuckle]` or `[sigh]` right in your sentence.
- **Stage directions:** Lucy Labs wrote code that turns notes like *(whispering)* or *(excited)* into the right knob settings.

> **Type this to Claude:**
> Add a "feelings" slider to my voice page that changes Chatterbox's exaggeration from calm to dramatic. Then make three test clips, at low, middle and high, and play them for me.

> **Type this to Claude:**
> I have 40 minutes of my own lively recordings, and a signed consent note. Help me train a small LoRA for Chatterbox on a rented GPU, with rank 32 and 3 epochs. Tell me the cost before you start, and switch the GPU off when you're done.

---

## Chapter 10 — Opening the Shop: Website, Domain and Payments
*(about 6 minutes)*

`[ON SCREEN: An empty shop. A sign goes up: "lucylabs.app". A cash register appears. The doors open.]`

**NARRATOR:**
You've got a talking model. Now let's turn it into a **shop** that anyone in the world can visit. You need four things: a **building**, an **address**, a **till**, and a **notebook**.

### The building: Vercel

**NARRATOR:**
Your website is code in your project folder. To let the whole world visit it, it has to live on a computer that's always switched on. **Vercel** is a service that does exactly that.

And here's the cool bit. You connect Vercel to your **GitHub**. Every time Claude saves a new version to GitHub, Vercel **automatically** puts the new version online, in about a minute. That's how Lucy Labs works: Claude saves to GitHub, and the website updates itself.

The website is the **front** of the shop: the text box, the voice picker and the play button. When someone presses play, the website sends the words to the **GPU on Modal**, which is the **kitchen in the back**, and the voice comes back.

### The address: a domain from GoDaddy

`[ON SCREEN: The GoDaddy website. Typing "mytalkingcomputer" into the search box. ".com — taken. .app — available! $..."]`

**NARRATOR:**
Every website has a computer address made of numbers, which nobody can remember. A **domain** is a name that points to it, like **lucylabs.app**.

You **rent** a domain, usually for a year at a time, from a company called a **registrar**. **GoDaddy** is a popular one. A grown-up searches for the name you want, and if it's free, buys it. That's usually somewhere around $15 to $30 a year.

Then you connect it to Vercel. Vercel shows you a couple of lines called **DNS records**, and you copy them into GoDaddy. **DNS** is the internet's phone book. It tells everyone's computer, "lucylabs.app lives over there!"

> **Type this to Claude:**
> I bought the domain mytalkingcomputer.app on GoDaddy. Walk me through connecting it to my Vercel website, one click at a time.

Fun fact: Lucy Labs wanted a different name, but the domain was taken, so they picked **lucylabs.app**. Always check the domain before you fall in love with a name!

### The till: Stripe

`[ON SCREEN: A Stripe checkout page. "Lucy voice credits — $5". A card form. "Payment successful!"]`

**NARRATOR:**
GPUs cost money, so most voice websites charge a little. **Stripe** is the till. When someone pays:
1. Your website sends them to a **Stripe checkout page**. Stripe handles the card safely, so **your website never touches card numbers**.
2. Stripe takes the money and keeps a small slice, usually a few percent per sale.
3. Stripe sends your website a message saying "they paid!". That message is called a **webhook**.
4. Your website gives them their **credits**: so many seconds of voice.

Stripe needs a **grown-up**, because it pays real money into a real bank account, with real business details.

**Real lesson from Lucy Labs:** check the payment *really* went through before giving credits. Their code now only gives credits when Stripe says the payment status is **"paid"**, and never twice for the same purchase. Claude found and fixed that in a safety check.

Stripe also has a **test mode** with pretend card numbers, so you can practise without spending a cent.

### The notebook: a database

**NARRATOR:**
Your shop needs to remember who has an account, how many credits they have, and which voices they made. That's a **database**: a super-organised notebook. Lucy Labs uses one called **Postgres**, which plugs into Vercel. Claude sets it up.

### Shop safety checklist

`[ON SCREEN: A checklist on the shop door.]`

- ✅ Keys in the secret file only.
- ✅ A spending limit on every cloud account.
- ✅ GPUs only wake up when someone presses play.
- ✅ Voice consent checkbox, plus "read this random sentence" proof.
- ✅ Watermark on every clip.
- ✅ A limit on how much one person can make per day.
- ✅ A "report this" button.

> **Type this to Claude:**
> Do a safety check of my whole website. Look for leaked keys, ways people could get free credits, ways people could upload someone else's voice, and anything that could cost me money while I sleep. Explain each problem simply, then fix them one at a time.

---

## Chapter 11 — Let's Build It! The Whole Thing, Prompt by Prompt
*(about 7 minutes)*

`[ON SCREEN: The Claude app. The Code tab clicked. Folder "my-talking-computer" chosen. A fresh, empty message box.]`

**NARRATOR:**
Now let's put it all together. Here's the whole build as a list of prompts. Do them **one at a time**, and check each one works before moving on. A grown-up should be nearby for anything with a 💳.

### Step 1: Set up the workshop

> **Type this to Claude:**
> Hi Claude! I'm a beginner and I want to build a text-to-voice website using the open-source model Chatterbox by Resemble AI. This folder is my project. Please check what's installed on my Mac (git, Python, Node, ffmpeg), install anything missing, and explain each tool in one sentence. Then make a plan for the whole project, explained like I'm 8. Don't spend money without asking.

Claude will install tools like **Homebrew** (an app store for code tools), **Python** (the language most AI is written in), **Node** (for websites), **git** (save points) and **ffmpeg** (for sound and video).

### Step 2: Save to GitHub

> **Type this to Claude:**
> Make this folder a git project, add a .gitignore so secret files and big audio files never get uploaded, and put it on my GitHub account as a private repository. Tell me when you need me to sign in.

### Step 3: Hear Chatterbox talk, on your own Mac

> **Type this to Claude:**
> Install Chatterbox in this project and make it say "Hello! I'm your new talking computer." in its default voice. Use my Mac's chip if it can. Play the sound for me and tell me how long it took.

The first time, it downloads the **weights from Hugging Face**. On a newer Mac with lots of memory, this can work at home. On an older Mac, it may be slow. That's when you'll want a GPU.

### Step 4: Clone your own voice, zero-shot

> **Type this to Claude:**
> Here is a 15-second recording of my own voice: raw_audio/me.wav. Use Chatterbox to say "I can't believe this is actually working!" in my voice. Make three versions with the exaggeration at 0.3, 0.5 and 0.8, and play them so I can pick my favourite.

### Step 5: Build the website

> **Type this to Claude:**
> Make a super simple website with a big text box, a voice picker, a "Read it to me" button and a play button. Make it colourful and friendly for kids. Run it on my computer and show me a screenshot.

### Step 6 💳: Put the voice brain on a GPU

> **Type this to Claude:**
> I want my website to use a GPU in the cloud so it works when my Mac is off. Compare RunPod and Modal for this, in simple words, including the price per hour and how long it takes to wake up. Recommend one. Then help me set it up so the GPU sleeps when nobody is using it. Ask before spending anything.

The grown-up makes the account and puts the key in the secret file.

### Step 7: Upload voices, with the kindness rules

> **Type this to Claude:**
> Add an "upload your voice" button. Require at least 15 seconds of audio, a consent checkbox, and a live recording of a random sentence that must match the uploaded voice. Then let the user type text and hear it in their voice.

### Step 8 💳: Train a LoRA (optional, for super-realistic voices)

> **Type this to Claude:**
> I have 45 minutes of my own lively recordings in raw_audio/me/ and a consent note. Clean them with Demucs, chop them into clips with Whisper, and train a small Chatterbox LoRA (rank 32, 3 epochs) on a rented GPU. Tell me the cost first. Afterwards, play me the LoRA voice and the zero-shot voice without telling me which is which, and switch the GPU off.

### Step 9 💳: Open the shop

> **Type this to Claude:**
> Put my website online with Vercel, connected to my GitHub. Then help me connect my GoDaddy domain. Then add Stripe in TEST mode so people can buy voice credits. Only give credits when Stripe says the payment is "paid".

### Step 10: Check and tidy

> **Type this to Claude:**
> Do a full safety and money check. Is anything still running and costing money? Are any secrets in GitHub? Then save everything to GitHub and write a STATUS file explaining what we built, so we can continue next time.

`[ON SCREEN: The finished website. A kid types "Once upon a time..." and presses play. Their own voice reads it back. They gasp and laugh.]`

**NARRATOR:**
And that's it. That's how a real text-to-voice platform gets built: one prompt, one check, one save point at a time.

It won't all work first time. Lucy Labs hit **dozens** of bugs. Tools that didn't install. A voice that came out nearly silent because of one bad recording. A GPU that wouldn't restart. Every time, they copied the error, gave it to Claude, and fixed it together. **Bugs aren't failures. They're clues.**

---

## Chapter 12 — More Open-Source Magic: Basic Pitch by Spotify
*(about 7 minutes)*

`[ON SCREEN: A kid humming into a phone. Musical notes appear on a piano roll as they hum.]`

**NARRATOR:**
Chatterbox isn't the only treasure. There are thousands of open models. Let's meet two amazing ones for **music**.

The first is **Basic Pitch**, made by **Spotify**, the music app. Our friend **Hayden Keys** used Basic Pitch in a project. *[Producer: add one sentence about what Hayden made.]*

### What does Basic Pitch do?

**NARRATOR:**
You give it a recording: you singing, a guitar, a piano. It listens and writes down **which notes were played, when they started, and how long they lasted**. It turns sound into **MIDI**.

**MIDI** is like sheet music for computers. It doesn't store the *sound*. It stores the *instructions*: "play middle C, now, for half a second, this loud". Then you can play those notes on any instrument in a music app. Hum a tune, and turn it into a trumpet!

### First: what is sound?

`[ON SCREEN: A guitar string twanging in slow motion. The air in front of it squishing and stretching. A wavy line drawn underneath.]`

**NARRATOR:**
When a guitar string twangs, it wiggles back and forth super fast. It pushes the air, squish, stretch, squish, stretch, and those wiggles travel to your ear. That's a **sound wave**.

How fast it wiggles is called its **frequency**, measured in **hertz (Hz)**, which means "wiggles per second".
- **Slow wiggles = low notes.** A big bass guitar string wiggles about 41 times a second: 41 Hz.
- **Fast wiggles = high notes.** The A note that orchestras tune to wiggles **440** times a second: 440 Hz.
- Go **up one octave** (from one C to the next C), and the wiggles **double**. 440 becomes 880.

### Notes have hidden helper notes

`[ON SCREEN: One string vibrating as a whole, then in halves, thirds and quarters, all at once.]`

**NARRATOR:**
Here's a secret. When you play one note, you don't hear just one frequency. A string wiggles as a whole **and** in halves, thirds and quarters at the same time. So a 100 Hz note also has quieter wiggles at 200, 300 and 400 Hz. These are called **harmonics**. They're why a piano and a guitar sound different even when they play the same note.

That makes computer listening hard: is that 200 Hz a *new* note, or just a harmonic of the 100 Hz note?

### How Basic Pitch listens

`[ON SCREEN: A spectrogram glowing. Then several copies of it, slid up and stacked like pancakes, with the glowing lines lining up.]`

**NARRATOR:**
1. **Make a picture of the sound.** Basic Pitch draws a **spectrogram**: time goes across, frequency goes up, and loudness glows. It uses a special version called a **CQT** (constant-Q transform) that's spaced like **piano keys**. Each step up is a musical step, not just "plus 10 hertz". So musical notes line up neatly.
2. **Stack the harmonics.** It makes copies of the picture, shifted up by 2 times, 3 times and so on, and **stacks them like pancakes**. Now a note and all its harmonics line up in one spot. That makes real notes easy to spot.
3. **A small neural network looks at the stack.** It's a **convolutional neural network**, a model that slides little "magnifying glasses" across a picture looking for patterns. It's the same kind of model that finds cats in photos. It makes three guesses, for every moment:
   - **Onset:** "Is a note *starting* right now?"
   - **Note:** "Is a note *playing* right now, and which one?"
   - **Pitch:** "Exactly how high, including bends?" Like a singer sliding up, or a guitarist bending a string.
4. **Turn guesses into notes.** A little bit of normal code joins the guesses into notes with a start and an end, and saves a **MIDI file**.

### How did Spotify build it?

**NARRATOR:**
The same **guess, check, nudge** loop as Chatterbox! They collected music where they **already knew the right notes**: piano recordings where a special piano wrote down every key press, guitar recordings with the notes marked, and singing with the notes written out. The model guessed the notes, checked against the real ones, and nudged its numbers. Millions of times.

The surprising part: Basic Pitch is **tiny**. Chatterbox has about 500 million numbers. Basic Pitch has fewer than **20,000**. That's why it runs fast on any laptop, even inside a web browser, and **doesn't need a GPU**. Spotify shared it with the **Apache 2.0** licence, on GitHub at **github.com/spotify/basic-pitch**.

### Ask Claude to try it

> **Type this to Claude:**
> Install Spotify's open-source Basic Pitch in a new folder. Here's a recording of me humming: humming.wav. Turn it into a MIDI file, then play the notes back on a piano sound so I can hear it. Explain what the onset, note and pitch outputs mean, like I'm 8.

> **Type this to Claude:**
> Make a little web page where I can record myself singing, and it shows the notes on a piano roll.

---

## Chapter 13 — More Open-Source Magic: Demucs by Meta
*(about 6 minutes)*

`[ON SCREEN: A fruit smoothie in a blender. A machine runs it backwards. Out pop a banana, a strawberry, a blueberry and a mango.]`

**NARRATOR:**
Imagine you have a smoothie, and someone asks you to **un-blend** it: back into banana, strawberry, blueberry and mango. Impossible, right?

That's what **Demucs** does to songs. Demucs was made by **Meta**, the company behind Facebook, and shared with the open **MIT licence**. You give it a song, and it gives you back separate tracks, called **stems**:
- 🎤 **vocals** (the singing),
- 🥁 **drums**,
- 🎸 **bass**,
- 🎹 **other** (guitars, piano, everything else).

You can make karaoke versions, remix songs, practise drums along with just the drums, or **clean a voice** away from background music. That's exactly what **Lucy Labs** used it for! In Chapter 8, Demucs pulled the teachers' voices away from music and noise before training. And Lucy Labs' video tool still uses Demucs today, to split a person's speech from the room sounds in a video.

### Why is un-mixing hard?

`[ON SCREEN: Four coloured waves (vocals, drums, bass, other) adding together into one messy grey wave.]`

**NARRATOR:**
When you mix sounds, their waves **add together** into one wave. All the information is still in there, squished together. Demucs has to work out which wiggles belong to which instrument.

It has two ways of looking at the song, like two detectives:
1. **The wave detective** looks at the raw sound wave over time. It's great at sharp, sudden things, like the **crack of a drum**.
2. **The picture detective** looks at the **spectrogram**, the picture of frequencies we met before. It's great at **steady notes**, like a long sung "ooooh" or a bass note, which show up as bright lines.

The newest Demucs is called **Hybrid Transformer Demucs**. It uses **both detectives at once**, and puts a **transformer** in the middle. That's the same kind of "attention" brain we met in Chatterbox. It lets the two detectives **talk to each other** and share clues: "I heard a drum hit here!" "I see a voice line there!"

The model's shape is called a **U-Net**. It's like a funnel: it squeezes the song down to the important ideas, then expands back out to full detail, with shortcuts on the side so tiny details aren't lost on the way.

### How did Meta build it? The smoothie trick

`[ON SCREEN: A chef making smoothies, writing down the exact fruits before blending each one.]`

**NARRATOR:**
How do you teach a model to un-blend? You **make the smoothies yourself**, so you know the answer!

1. Start with songs where you have **each instrument recorded separately**. There's a famous free collection called **MUSDB18** with 150 songs like this, and Meta added about **800 more** songs of their own.
2. **Mix** the stems together into a song.
3. Ask Demucs to **un-mix** it. That's the guess.
4. **Compare** its vocals with the real vocals, its drums with the real drums. That's the check.
5. **Nudge** the numbers.

Repeat millions of times, with lots of tricks: swapping drums from one song into another, changing speeds and pitches, so the model sees endless new smoothies.

Same loop as Chatterbox. Same loop as Basic Pitch. **Guess, check, nudge.** Almost every model you'll ever meet learns this way.

### Does it need a GPU?

**NARRATOR:**
Demucs works on a normal computer, but a song might take a minute or two. On a GPU it takes a few seconds. New Macs with powerful chips do a good job too. Lucy Labs ran it on a rented GPU because they had lots of audio to clean.

### Ask Claude to try it

> **Type this to Claude:**
> Install Meta's open-source Demucs and split this song I made, mysong.mp3, into vocals, drums, bass and other. Put each stem in a folder and play me just the vocals. Then make a karaoke version with no vocals.

> **Type this to Claude:**
> I recorded my voice outside and there's traffic noise. Use Demucs to pull out just my voice, and play me the before and after.

Only use songs **you made**, or songs you're allowed to use, if you're going to share what you make. Other people's music belongs to them.

---

## Chapter 14 — The Treasure Map: More Open-Source Projects, and Your Next Adventure
*(about 7 minutes)*

`[ON SCREEN: A treasure map. Islands labelled "Talking", "Music", "Videos", "Chat", "Money", "Pictures".]`

**NARRATOR:**
You've met three open models: **Chatterbox** for voices, **Basic Pitch** for notes, and **Demucs** for un-mixing. There are thousands more. Here are some famous islands on the treasure map.

### 🤖 Island of Chat: open language models

**NARRATOR:**
These are open cousins of chat helpers like Claude. You can download their weights from Hugging Face and run them yourself.
- **Llama** by Meta. Remember, Chatterbox borrowed Llama's shape!
- **Qwen** by Alibaba.
- **Mistral** by Mistral AI, from France.
- **DeepSeek** by DeepSeek, from China.
- **gpt-oss**, open models from OpenAI.

Small versions can run on a newer Mac with lots of memory. Giant versions need lots of GPUs. A free app called **Ollama** makes trying them easy.

### 🎬 Island of Video: open text-to-video models

**NARRATOR:**
Type a sentence, get a video clip:
- **Wan** by Alibaba,
- **HunyuanVideo** by Tencent,
- **LTX-Video** by Lightricks.

Video models are **very hungry**. Remember, a video can cost 10 to 100 times more GPU work than a voice. Most need a big rented GPU.

### 📈 Island of Money: open algorithmic trading projects

`[ON SCREEN: A chart going up and down. A robot with a notepad labelled "practice only".]`

**NARRATOR:**
**Algorithmic trading** means writing rules for a computer to buy and sell things, like "buy when the price drops this much". There are open projects that let you write those rules and **test them on old prices** to see what *would* have happened. That test is called **backtesting**.
- **Freqtrade**, a free trading bot you can program and test.
- **LEAN** by QuantConnect, a big trading engine used by lots of people.
- **Backtrader**, a Python toolbox for testing trading ideas.
- **Qlib** by Microsoft, which uses AI models to study markets.

**Important:** these are amazing for **learning maths and coding**, and you can do **paper trading**, which means pretend money. But markets are risky. Real money is a **grown-ups-only** decision, and testing on the past never promises the future.

### 🌍 More amazing islands

- **Whisper** by OpenAI turns speech into text in about 100 languages. Lucy Labs used it to write down every word in its voice clips!
- **Stable Diffusion** and **FLUX** make pictures from words.
- **Segment Anything** by Meta cuts out any object in a photo with one click.
- **AudioSeal** by Meta adds invisible watermarks to sound.

### The big secret of this whole course

`[ON SCREEN: The kid from Chapter 1, now with their own website, their own voice and a Basic Pitch song. They look at the camera.]`

**NARRATOR:**
You've learned a lot today:
- A **model** is a giant recipe of numbers called **weights**, learned by **guess, check, nudge**.
- **Closed** models are secret recipes you use over the internet. **Open** models share their code, their weights and a licence.
- **GitHub** keeps code. **Hugging Face** keeps model weights.
- A **GPU** is thousands of helpers doing simple maths at once. New Macs with powerful **M5** chips and lots of memory can run a lot at home, but for **training** and **lots of users** you rent GPUs from **neoclouds** like **RunPod** and **Modal**.
- **LoRA** adds small **sticky notes** to a big model to teach it something new, cheaply.
- A real website needs a **domain** (like from **GoDaddy**), a home (like **Vercel**), a till (**Stripe**) and kindness rules.
- And **Claude**, in the **Code** tab, can help you build all of it, one prompt at a time.

But here's the biggest secret of all.

**You don't have to know where the treasure is.** You just have to ask.

Whatever you love, there's probably an open-source model for it. Dinosaurs. Football. Space. Drawing. Birdsong. Music. Coding games. And Claude can help you find it, read its licence, install it and play with it.

> **Type this to Claude:**
> I love ________. Find me an open-source model about ________ on GitHub or Hugging Face. Tell me what it does, what licence it has, and whether it can run on my Mac or needs a GPU. Then help me try it, one step at a time, without spending money.

So go on. Open the Claude app. Click **Code**. Pick a folder. Tell Claude your dream.

**And go build something amazing.**

`[ON SCREEN: "Go build something amazing." The Claude app's Code tab, cursor blinking.]`

---

## Producer notes (not read aloud)

- **The Hayden Keys line (Chapter 12)** came from the brief. Hayden's actual project is not in the Lucy Labs notes, so fill in one true sentence before recording.
- **Plans and ages:** Claude's consumer plans require users to be 18+, so the course frames a grown-up as the account holder throughout. Check current plan names, prices and which plans include Claude Code before filming.
- **Prices:** GPU, domain, Stripe and Vercel prices are from the Lucy Labs build (Sept–Oct 2026) or are rough ranges. Re-check them before publishing.
- **Real Lucy Labs facts used:**
  - Chatterbox is by Resemble AI, MIT licence, trained on ~500,000 hours.
  - The first zero-shot test used ~14–15 s clips and was called "robotic".
  - The first LoRAs trained in ~2.5 min each on an RTX 4090 at ~$0.74/hr; the whole step cost ~$0.55.
  - The LoRA recipe went from r128 / 10 epochs to r32 / 3 epochs, on attention only.
  - About 17 voice LoRAs share one model on Modal.
  - On Modal, a cold start took ~141 s and a warm one 10–17 s; the L40S costs ~$1.95/hr.
  - The homepage warm-up bug.
  - Stripe credits are given only on a "paid" status.
  - Sources: `PROJECT_CONTEXT.md`, `STATUS.md`, `docs/voice-lora-recipe.md` and `docs/voice-reference-recording.md`.
- **Accuracy:**
  - The Chatterbox architecture (voice encoder, T3, S3Gen, HiFi-GAN-style vocoder, Perth watermark) follows the public Chatterbox repository.
  - The Basic Pitch description (harmonic CQT; onset, note and pitch outputs; under 20k parameters) follows Spotify's 2022 paper.
  - The Demucs description (Hybrid Transformer Demucs; MUSDB18-HQ plus ~800 extra songs) follows Meta's paper.
  - Exact numbers are simplified for kids.
