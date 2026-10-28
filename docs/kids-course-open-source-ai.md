# Build Anything with Open-Source AI
### A course for young builders: build a real app with Claude and free open-source models

This is the final narration, word for word, as voiced in the videos (7 chapters, version 3). The narrator is Gemini TTS **Sulafat** (Australian English) with a natural, unscripted-talking direction. Each chapter has a video and a subtitle file in `deliverables/kids-course/renders3/`.

> **Voice cloning note (Chapter 6):** voice cloning has been misused to trick and fool people. It's for entertainment and learning only. Only use someone's voice if they've said yes.

## Chapter 1: Hello, Builder!

Chapter one. Hello, builder!

Hi! We hear a lot about open versus closed source models. But what does that actually mean? And how can we use simple prompts in Claude Code, to use these open source models, and build really cool projects? Let's explore.

You don't need any technical skills at all. Ask your mum or dad for a Claude subscription. You do need to download the app, and use Claude Code.

Open the Claude app. At the top, you'll see a button that says Code. That's the magic button! It opens Claude Code, where Claude can actually build things on your computer.

It's as easy as talking to Claude like a friend. Write in plain, simple English, and let it do all the technical stuff for you.

You can also use other AI helpers, like ChatGPT's Codex, or whatever you prefer. This is in no way sponsored. Use whatever you like! For this course, I'll be using Claude.

So, what's the difference between open and closed? A closed model is like a famous restaurant's secret recipe. You can taste the food, but you can't see the recipe, or take it home. Claude, ChatGPT and Gemini are closed models.

An open source model is a recipe anyone can download for free, cook at home, and even change however they like. And there are some amazing ones out there.

In this course, you'll use them to build two real things. First, a feature that listens to any song, and teaches you to play it on the piano. Then, a studio that can copy a voice from just fifteen seconds of talking.

You can build anything you can imagine. Let's get into it, and explore!

## Chapter 2: Learn Any Song

Chapter two. Learn any song.

Meet Hayden Keys. It's a free app that teaches you piano, a bit like a game. Coloured blocks fall down the screen, and when one lands on a key, you play that key.

The team had a big idea. What if anyone could upload their favourite song, and an AI model would work out the notes, and teach them how to play it?

But how do you build something like that? Here's the secret. You don't need to know how. You just need to know who to ask.

Step one. Open Claude, and ask what open source models already exist. It goes off, does some research, and comes back with two perfect ones.

The first is Demucs, made by Meta. Think of a song like a smoothie. Demucs un-blends it! You give it a song, and it hands you back the separate layers. The singing, the drums, the bass, and everything else.

The second is Basic Pitch, made by Spotify. It listens to music, and writes down every note. Which key, when it starts, and how long it lasts.

Put them together, and you've got your feature. Demucs pulls out the piano. Basic Pitch writes down its notes. And your app turns them into falling blocks, to play along with.

Both are free, and both are open source. Years of clever work, given away to anyone who wants it.

## Chapter 3: Let's Build It!

Chapter three. Let's build it!

Step two. Ask Claude to build it for you. But first, you'll need two things.

Number one. GitHub. GitHub is like Google Drive, but for code. It keeps all your project's files safe online, with save points. So if something breaks, you can always go back.

Number two. A terminal. That's a window where you, or Claude, type commands to the computer. Every Mac already has one, called Terminal. Or you can use a free app called VS Code.

Step three. Your website needs an address, like haydenkeys dot com. That's called a domain. You can buy one from GoDaddy, or places like it, for about fifteen to thirty dollars a year. Ask a grown-up to help with that bit.

And that's really it! Claude will guide you through everything else. Just follow along.

It might ask you to set up a few accounts. Like Vercel, which puts your website on the internet. Or Stripe, if you choose to take payments. Whenever it needs you, it'll stop, and tell you exactly what to click.

Talk to Claude like a friend. Tell it your idea, ask questions, and tell it when something looks wrong. It'll build everything with you.

Okay. Let's try it out!

We type: Hi Claude! I want to add a feature to my piano app. People upload a song they love, and it teaches them to play it. Use the open source models Demucs and Basic Pitch. Explain each step simply, and ask me before spending any money.

Claude makes a plan, and gets to work. It installs the tools, writes the code, and saves everything to GitHub.

Then it tests everything, by itself. Something breaks? It reads the error, and fixes it. It might also suggest renting a GPU, because splitting songs is heavy work. It'll tell you the cost first.

When it's ready, it puts your site online, and connects your domain.

And now, the moment of truth. Upload a song.

Demucs splits it into layers. Vocals, drums, bass, and the piano. Then Basic Pitch writes down every piano note. And there it is! Your song, as falling blocks, ready to play.

How cool is this? You can upload any song, and it pulls out the piano notes for you. You can learn your favourite songs, from the artists you love. Learn from the best!

And then, try making your own music too! Just remember to only upload songs you're allowed to use. Other people's music belongs to them.

## Chapter 4: How Does It Really Work?

Chapter four. How does it really work?

By the way, now that you've built it, let's see how it actually works. How were Demucs and Basic Pitch made? Let's start with Demucs.

Demucs was built by a small team of researchers at Meta's AI lab in Paris, led by a scientist called Alexandre Défossez.

So, what did they do when they came into work? A lot of it looked like this. Coffee. Reading research papers, to see what other teams had discovered. Writing code. And listening, lots of listening, to check if the drums really came out clean.

First, sound has to become numbers. A recording is a wiggly wave. The computer measures its height forty-four thousand times every second. So one song is millions of numbers.

Next, the training songs. To teach a model to un-mix a song, you need the answers. Songs where every instrument was recorded on its own. Those separate tracks are called stems.

There's a famous free collection called MUSDB eighteen, with a hundred and fifty songs like this. The Meta team added about eight hundred more of their own.

How do the files get into the model? They sit on big storage drives. A bit of code called a data loader picks a song, cuts out a few seconds, and turns it into numbers. Then it does that again and again, and feeds them to the model in batches.

And here's a clever trick. The loader mixes the drums from one song with the bass from another, and changes the speed and the pitch. So the model hears endless brand new songs.

They didn't start from scratch. They built on PyTorch, a free toolbox, also made at Meta, that does all the heavy maths on GPUs. Almost every AI model you've heard of is built on PyTorch, or a toolbox like it.

Then they wrote the code that sets up the model. It's a list of layers, like an assembly line. Some layers listen to the wave. Some look at a picture of the sound. And a transformer in the middle lets them share clues.

Then comes the training loop. Mix the stems into a song. Ask the model to un-mix it. Compare its drums with the real drums, and measure how wrong it was. Then nudge all its numbers a tiny bit, to be a little less wrong next time.

Does a person check all those millions of guesses? Nope! The computer already knows the answer, because it made the mix itself. So it marks its own homework, millions of times.

All this runs on GPUs, powerful chips in huge buildings called data centres, humming away for days. Then the team listens to the results, tweaks the recipe, and trains again.

When it finally sounded great, they wrote a paper explaining how it works, put the code on GitHub, and shared it with the world, for free.

## Chapter 5: Inside Basic Pitch

Chapter five. Inside Basic Pitch.

Basic Pitch was built by the Audio Intelligence Lab at Spotify, a team of music scientists who love music as much as maths. One of the lead researchers is Rachel Bittner.

Their goal was different. Not un-mixing. Listening, and writing down the notes. And they wanted it small and fast enough to run on your phone.

To learn notes, a model needs recordings where the right notes are already known. So they gathered some very special music.

Piano, played on special pianos that record every key press. Guitar, recorded with a tiny microphone on each string. Singing, with every note written down. And songs played by a computer, from note files, so the answers are perfect.

Then they hit a tricky problem. When you play one note, you don't just hear that note. You also hear quieter notes above it, called overtones. Like a little ghost choir, singing along.

So they used a clever trick called harmonic stacking. They make copies of the sound picture, shifted, so a note and all its overtones line up in one neat column. Then the model can spot the real note, easily.

They built it with TensorFlow, a free toolbox from Google that's a lot like PyTorch. And the model is tiny. Fewer than twenty thousand numbers! The voice model we'll meet next has about five hundred million.

And it learns the same way. Guess the notes. Check them against the real notes. Nudge. Over and over, on GPUs, until it's really good.

Spotify shared it for free, with an open licence. That's why apps like Hayden Keys can run it right inside your web browser, without paying a cent per song.

And that's the big secret. Every model you'll ever use is made of people, data, and lots of guess, check, nudge.

If you're curious, go down the rabbit hole with Claude! Ask it things like: show me the code that sets up Demucs, and explain each line like I'm ten. Or: how does harmonic stacking work? Draw me a picture.

There's no wrong question. Claude never gets tired of explaining.

## Chapter 6: Recreate Any Voice

Chapter six. Recreate any voice.

There are open source models for all kinds of things. Let's try another one. Text to voice. You type some words, and a voice reads them out loud.

And the newest ones can copy almost any voice, from just fifteen seconds of someone talking.

Now, a quick but really important note. Voice cloning has been misused, to trick and fool people. So this is for entertainment and learning only. Please only ever use someone's voice if they've said yes.

It's simply to show you the magic of technology, and of open source models that are getting better and better, so quickly.

Step one. Ask Claude which open source models exist for text to voice. It'll find you a few.

Step two. Pick one. We'll choose Chatterbox, made by a company called Resemble AI. It's free, it sounds great, and it can copy a voice from a short clip.

Step three. Ask Claude to build it, just like before. You'll need GitHub, and a domain for your website. Chatterbox needs a GPU to run fast, so Claude might suggest renting one, for less than a dollar an hour.

Step four. You've got the model! Now for the fun part. Record fifteen seconds of a friend talking, with their permission. Upload it, type anything, and hear it spoken back, in their voice!

Step five. Sometimes the copy sounds a bit flat, or not quite like them. That's when you can add a LoRA.

Imagine Chatterbox is a giant book about how people talk, with hundreds of millions of numbers. Instead of rewriting the whole book, you add a few tiny sticky notes. That's a LoRA. The big book stays frozen, and you only train the sticky notes.

So you give it a bit more of your friend's voice, maybe half an hour, with their permission. You train the sticky notes on a rented GPU, for a few minutes. And now it really sounds like them. Their laugh, their rhythm, their excitement!

Isn't that amazing? You're basically training your own AI model!

## Chapter 7: Find Any Model

Chapter seven. Find any model.

Here's the biggest secret of this whole course. Whatever you're into, there's probably an open source model for it. Just ask Claude. And they're free to play with.

Love making films? There are open models that turn words into videos, like Wan, from Alibaba.

Want your own AI helper? Open chat models, like Llama and Qwen, can run on your own computer. And you can build your own agent, that does jobs for you.

Into money and markets? There are open source tools, like Microsoft's Qlib, that help you test trading ideas the way hedge funds do, on old prices. Practise with pretend money only, and always ask a grown-up before anything real.

Love games? There are open models that make 3D objects, music, and character voices. And free game engines, like Godot, to put it all together.

Find anything that interests you. Ask Claude what exists, ask it to build something, and experiment. Break things. Fix them. Try again.

Why do companies give these models away? Sometimes, it's to compete with the big closed models. If you can't win by selling, make yours free, so everyone uses it.

And sometimes, it's just because people love building things, and want to share them. That's how a lot of science works.

So take these models, and make them your own. Play around, wander around, and let your mind explore!

It may sound complicated. And that's because it is! But a lot of amazing researchers have worked really hard on it, and now it's there for you to use. Ask Claude to explain everything, and have fun with it.

And maybe someday, you'll help create an amazing open source model, and share it with the world.
