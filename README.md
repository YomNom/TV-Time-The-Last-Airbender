# TV Time: The Last Airbender

This project provides visualization of a text analysis done on transcripts for Avatar: The Last Airbender. These visualizations are visualized on a web page we made public on vercel. The show is a beloved childhood show of the creators of this project and is still popular today with a sequel show and movie (don't mention the live actions). These transcripts were sourced from Kaggle. However, we have scripts that were made if you were to want to replicate this project and do the scraping yourself.

We go through the scripts to see:  
- How many characters appear in each episode 
- Who appears in each episode
- For each character: 
  - How often do they appear in each episode/season
  - What do they tend to talk about
  - How often do they share a scene with other characters
 
This analysis is performed out of interest in the show and to understand more about the structure of the show, specifically to identify any overarching pattern in the show. Below is a runthrough of the website built in this project. 

https://github.com/user-attachments/assets/a85b907f-ed70-4a59-a325-fe7114096613

## How to Run

> 1.  Clone the repository.
> 2.  Launch a local web server in the root directory (e.g., `python -m http.server 8000`).
> 3.  Navigate to `http://localhost:8000` via web browser.

## [Data]([https://avatar.fandom.com/wiki/Category:Avatar:_The_Last_Airbender_episode_transcripts](https://www.kaggle.com/datasets/brunovr/avatar-the-last-airbender-complete-transcript/data))

The dataset was sourced from Kaggle and was made by BrunoVR. The link is available in the title of this section. They scraped the data from fandom, removing punctuation and making all characters lower-case. If we were to work further, we would have scraped character images and their descriptions from fandom personnally. We do have a script for doing so by Quoc, although we have not used it so far.

There are 5 columns in this datasets corresponding to character lines and scene description from Avatar: The Last Airbender.

- Character: name of the character (if blank, it's a description text)
- script: the character (or description) line
- ep_number: episode number in Book (season)
- Book: season
- total_number: episode number across entire show

Character and script are strings and the rest are integers. We left off lines with no speaker.

We organized the data into two structures. One was a mapping with the character name as a key and an array of their lines as a value. This was for analyzation. The other was for display in the character rankings: an array of objects containing the character name, the episodes the character was in, and their lines. This was done also for modularity to fill in static info.

## Sketches

Initially, we had wanted to have an episode filter. However, it didn't really fit into what we were showing for each character. We would have placed it under the season filter.

<img width="1065" height="1085" alt="image" src="https://github.com/user-attachments/assets/37b48509-7a6a-4af5-8877-4d8700f74312" />

We didn't really have a stable idea for the layout but it worked out that the filter didn't do episodes because two of our visuals aren't affected by the season filter and have their own search methods.

## Discoveries
### Sokka Speaks the Most for Most of the Seasons

Although Aang says the most lines overall, Sokka has the most lines for Season 2 and 3 individually and combined. Aang overcomes him with the inclusion of season 1.

<img width="671" height="1093" alt="Screenshot 2026-04-29 134428" src="https://github.com/user-attachments/assets/a622c4e9-f5e0-404d-a35e-fa04890ff46c" />

### Honor is Not Zuko's Most Common Word

Many viewers' impression of Zuko from his first appearances in season 1 is his desire to regain his honor. "I must capture the Avatar and regain my honor" is a well-known phrase of his. 

<img width="148" height="148" alt="image" src="https://github.com/user-attachments/assets/c545b1b2-cb4d-4295-b4ec-7749f91ebcdb" />

However, even with just season 1 selected, his most common word is "avatar" and "uncle". Honor isn't even really listed in his top words.

<img width="2175" height="1153" alt="image" src="https://github.com/user-attachments/assets/7bcd4861-523a-437b-836a-da5e7a8c9def" />

But he does say it the most out of all the characters. 

<img width="1356" height="712" alt="image" src="https://github.com/user-attachments/assets/1941d09b-bf95-4b62-90ec-1cbd9d2be8b6" />

## Assets

Although it is subtle, we have a background image sourced from unsplash by Robynne O. It can be accessed https://unsplash.com/photos/gray-rock-formations-iVYTAfsN9hk. 

<img width="1740" height="1161" alt="image" src="https://github.com/user-attachments/assets/150e956e-dee3-4377-b7eb-ecd2ce8242f8" />

The avatar logo was obtained from Wikipedia.

<img width="300" height="128" alt="image" src="https://github.com/user-attachments/assets/44daf65e-d626-4d50-9240-40a0f33ed15e" />

## Libraries

## Code Structure

### Season Filter

This filter enables users to filter the data by season for the two visuals directly under it. There are only three seasons, which is why we found a remove all button to be unneccessary. We still included show all because we believed there'd be more intent to do that. Also, the filter stops the user from not selecting any season. If only one season is selelected, the user can no longer deselect a season.

https://github.com/user-attachments/assets/8982afd1-4caa-4ab2-8b0d-74c5490190c1

We didn't include an episode filter because it left too much room in the character profile. We also didn't want to enable to user to select more than one episode because the time we wanted to work on this wasn't enough. It also was considered to be possibly tedious for the user. Should more work be put into this, it would be something to prioritize, maybe with a specialized view.

### Character Selection

Here, the selection works also as a visual to show information about the overall cast of characters. You can see which episodes the characters are in and how many lines each character has. This visual is also a method where users can see who are major characters. They are listed in a vertically scrollable list by how many lines they have. The top being the most lines. You can also search for characters in the list.

https://github.com/user-attachments/assets/b3e50bcf-a3d3-417b-b5e8-f700ca6d4f26

Each of these can be selectable and be displayed in the character profiles.

### Character Profiles

<img width="2189" height="1151" alt="Screenshot 2026-04-29 132329" src="https://github.com/user-attachments/assets/a81639c6-47fc-4c00-8f23-2f865f906ff3" />

<img width="2191" height="1153" alt="Screenshot 2026-04-29 132403" src="https://github.com/user-attachments/assets/a636480c-8858-43ed-b86c-15d3d7946fe4" />

### Phrase LifeCycle Explorer

WHY NAME IT THAT

<img width="1357" height="1344" alt="Screenshot 2026-04-29 133229" src="https://github.com/user-attachments/assets/8d1dbced-9850-4952-833f-2ef11ec1234c" />

### Character Relationships

<img width="1409" height="471" alt="Screenshot 2026-04-29 133404" src="https://github.com/user-attachments/assets/2edf0352-6a71-4f76-adc8-3af6e15a1ebd" />

<img width="1357" height="1326" alt="Screenshot 2026-04-29 133353" src="https://github.com/user-attachments/assets/121f8306-dbcd-48f3-b449-836a07c7a10c" />

## What Each Person Worked On

- **Quoc Huynh [kiq2908]:** Made the script to scrape data as an alternative method to scrape data
- **Tyler Brunelle [tybrun]:** Created the chord diagram showing the character relationships for each episode
- **Dylan Francis [dylfrancis]:** Word on layout and styling, created the character profiles i.e. what the most common words and phrases the characters said
- **Joey Yong [YomNom]:** Worked on the layout and styling, created the character rankings, filter, and show summary
- **Kaleab Alemu [kaleabtesfayes]:** Created the Phrase Lifecycle Explorer
