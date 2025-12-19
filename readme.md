# Overlay with HTMX + ExpressJS v2

## What you need?
1. You need nodeJS (https://nodejs.org/en/download)
2. use this link: https://nodejs.org/dist/v24.12.0/node-v24.12.0-x64.msi

## To run the overlay
Just use `npm run dev`
To get to dashboard its: `http://localhost:5000/dashboard`
To get to Top8 its: `http://localhost:5000/dashboard/top8?tournament=&event=&game=` (this is default skin, use game promt and a skin will be offered).
To get to overlay: `http://localhost:5000/overlays/*Game name*`

## What game skins do I have?
- Guily Gear Strive
- 2xko
- Street Fighter 6
- Tekken 8
- King Of Fighters 13

## No name?
This time its based on Start.gg instead of manually write them in

## No Flag?
This time its based on name via Start.gg, example:
- If you are regular attentat to certain weekly tournament then once your name has located we will "save" it.
- Once your name is regeristred in our file we will just add your flag. 
- If you dont want flag you wont get one (that easy).