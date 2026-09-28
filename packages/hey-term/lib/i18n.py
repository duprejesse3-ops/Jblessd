# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Spoken-language strings and confirm/cancel word lists for Hey Term.

The wake phrase itself ("Hey Term") is NOT translated -- like "Hey Siri" or
"Hey Google", it's the product's name, said the same way regardless of what
language you're speaking otherwise. See lib/wake.py and lib/transcribe.py's
transcribe_wake() for why the wake pass always decodes as English even when
LANGUAGE is set to something else.

Everything AFTER the wake word -- what it says back to you, and what counts
as a yes/no from you -- follows LANGUAGE.

Six languages ship translated by hand (not machine-translated) because I can
vouch for their accuracy; Whisper and Claude both understand many more than
that, so a request spoken in an untranslated language still gets planned and
run correctly, it just gets the English prompts/confirmation words back
until someone adds that language here. See README.md "Adding a language".
"""

DEFAULT_LANGUAGE = "en"

LANGUAGES = {
    "en": {
        "name": "English",
        "whisper_code": "en",
        "ready": "Hey Term ready.",
        "listening_prompt": "Yes?",
        "not_caught": "I didn't catch that.",
        "canceled": "Canceled.",
        "ask_confirm": "Say confirm to run it, or cancel.",
        "unclear_cancel": "I didn't catch a clear yes or no, so I'm canceling this one. Just ask again if you still want it.",
        "requires_typed": "This includes something on my do-not-run-by-voice list, so I need you to type CONFIRM to proceed.",
        "typed_confirm_prompt": "Type CONFIRM (all caps) to run these commands, or press Enter to cancel: ",
        "stopping": "Stopping. Say the wake word again any time.",
        "agent_error": "Something went wrong asking Claude how to do that. Check the terminal for details.",
        "fallback_language_notice": "I don't have that language translated yet, so I'll use English for now.",
        "offline_notice": "I can't reach Claude right now, so I'm using a basic offline command for this.",
        "offline_no_match": "I can't reach Claude to plan that, and it's not one of the basic commands I can run offline.",
        "background_started": "Started in the background. Say jobs to check on it.",
        "jobs_none": "No background jobs yet.",
        "revert_none": "Nothing to revert.",
        "revert_done": "Reverted {n} file(s).",
        "yes_words": {"confirm", "confirmed", "yes", "yeah", "yep", "sure", "do it", "go ahead", "run it", "proceed"},
        "no_words": {"cancel", "cancelled", "canceled", "no", "nope", "stop", "abort", "don't", "never mind", "nevermind"},
        "stop_phrases": {"stop listening", "shut down", "power off", "goodbye"},
        "command_singular": "command",
        "command_plural": "commands",
        "done_prefix": "Done.",
        "ran_successfully": "ran successfully.",
        "stopped_prefix": "Stopped partway:",
        "failed_word": "failed",
        "skipped_word": "skipped after that",
    },
    "es": {
        "name": "Español",
        "whisper_code": "es",
        "ready": "Hey Term listo.",
        "listening_prompt": "¿Sí?",
        "not_caught": "No entendí eso.",
        "canceled": "Cancelado.",
        "ask_confirm": "Di confirmar para ejecutarlo, o cancelar.",
        "unclear_cancel": "No entendí un sí o no claro, así que voy a cancelar esto. Pídemelo de nuevo si todavía lo quieres.",
        "requires_typed": "Esto incluye algo de mi lista de no-ejecutar-por-voz, así que necesito que escribas CONFIRM para continuar.",
        "typed_confirm_prompt": "Escribe CONFIRM (en mayúsculas) para ejecutar estos comandos, o presiona Enter para cancelar: ",
        "stopping": "Deteniendo. Di la palabra de activación cuando quieras.",
        "agent_error": "Algo salió mal al preguntarle a Claude cómo hacer eso. Revisa la terminal para más detalles.",
        "fallback_language_notice": "No tengo ese idioma traducido todavía, así que usaré inglés por ahora.",
        "offline_notice": "No puedo comunicarme con Claude ahora mismo, así que voy a usar un comando básico sin conexión para esto.",
        "offline_no_match": "No puedo comunicarme con Claude para planear eso, y no es uno de los comandos básicos que puedo ejecutar sin conexión.",
        "background_started": "Iniciado en segundo plano. Di jobs para revisarlo.",
        "jobs_none": "Todavía no hay tareas en segundo plano.",
        "revert_none": "No hay nada que revertir.",
        "revert_done": "Se revirtieron {n} archivo(s).",
        "yes_words": {"confirmar", "confirmado", "sí", "si", "vale", "dale", "adelante", "hazlo", "procede"},
        "no_words": {"cancelar", "cancelado", "no", "para", "detente", "aborta", "olvídalo", "olvidalo"},
        "stop_phrases": {"deja de escuchar", "apágate", "apagate", "adiós", "adios"},
        "command_singular": "comando",
        "command_plural": "comandos",
        "done_prefix": "Listo.",
        "ran_successfully": "se ejecutaron correctamente.",
        "stopped_prefix": "Se detuvo a mitad de camino:",
        "failed_word": "fallaron",
        "skipped_word": "se omitieron después",
    },
    "fr": {
        "name": "Français",
        "whisper_code": "fr",
        "ready": "Hey Term est prêt.",
        "listening_prompt": "Oui ?",
        "not_caught": "Je n'ai pas compris.",
        "canceled": "Annulé.",
        "ask_confirm": "Dis confirmer pour l'exécuter, ou annuler.",
        "unclear_cancel": "Je n'ai pas entendu un oui ou un non clair, donc j'annule celui-ci. Redemande si tu le veux toujours.",
        "requires_typed": "Ceci inclut quelque chose sur ma liste à ne pas exécuter par la voix, donc j'ai besoin que tu tapes CONFIRM pour continuer.",
        "typed_confirm_prompt": "Tape CONFIRM (en majuscules) pour exécuter ces commandes, ou appuie sur Entrée pour annuler : ",
        "stopping": "Arrêt. Dis le mot d'activation quand tu veux.",
        "agent_error": "Un problème est survenu en demandant à Claude comment faire cela. Vérifie le terminal pour plus de détails.",
        "fallback_language_notice": "Je n'ai pas encore cette langue traduite, donc je vais utiliser l'anglais pour l'instant.",
        "offline_notice": "Je ne peux pas joindre Claude en ce moment, donc j'utilise une commande de base hors ligne pour ça.",
        "offline_no_match": "Je ne peux pas joindre Claude pour planifier ça, et ce n'est pas une des commandes de base que je peux exécuter hors ligne.",
        "background_started": "Démarré en arrière-plan. Dis jobs pour vérifier.",
        "jobs_none": "Aucune tâche en arrière-plan pour l'instant.",
        "revert_none": "Rien à annuler.",
        "revert_done": "{n} fichier(s) annulé(s).",
        "yes_words": {"confirmer", "confirmé", "oui", "ouais", "vas-y", "fais-le", "d'accord", "daccord", "procède"},
        "no_words": {"annuler", "annulé", "non", "arrête", "arrete", "stop", "laisse tomber"},
        "stop_phrases": {"arrête d'écouter", "arrete d'ecouter", "éteins-toi", "eteins-toi", "au revoir"},
        "command_singular": "commande",
        "command_plural": "commandes",
        "done_prefix": "Terminé.",
        "ran_successfully": "exécutée(s) avec succès.",
        "stopped_prefix": "Arrêté en cours de route :",
        "failed_word": "ont échoué",
        "skipped_word": "ont été ignorées ensuite",
    },
    "de": {
        "name": "Deutsch",
        "whisper_code": "de",
        "ready": "Hey Term ist bereit.",
        "listening_prompt": "Ja?",
        "not_caught": "Das habe ich nicht verstanden.",
        "canceled": "Abgebrochen.",
        "ask_confirm": "Sag bestätigen, um es auszuführen, oder abbrechen.",
        "unclear_cancel": "Ich habe kein klares Ja oder Nein gehört, also breche ich das hier ab. Frag einfach nochmal, wenn du es noch willst.",
        "requires_typed": "Das enthält etwas von meiner Nicht-per-Sprache-ausführen-Liste, also musst du CONFIRM eintippen, um fortzufahren.",
        "typed_confirm_prompt": "Tippe CONFIRM (großgeschrieben) ein, um diese Befehle auszuführen, oder drücke Enter zum Abbrechen: ",
        "stopping": "Stoppe. Sag jederzeit das Aktivierungswort.",
        "agent_error": "Beim Fragen von Claude ist etwas schiefgelaufen. Details im Terminal.",
        "fallback_language_notice": "Diese Sprache ist noch nicht übersetzt, also verwende ich vorerst Englisch.",
        "offline_notice": "Ich kann Claude gerade nicht erreichen, also verwende ich dafür einen einfachen Offline-Befehl.",
        "offline_no_match": "Ich kann Claude nicht erreichen, um das zu planen, und das ist keiner der einfachen Befehle, die ich offline ausführen kann.",
        "background_started": "Im Hintergrund gestartet. Sag jobs, um nachzusehen.",
        "jobs_none": "Noch keine Hintergrundaufgaben.",
        "revert_none": "Nichts rückgängig zu machen.",
        "revert_done": "{n} Datei(en) zurückgesetzt.",
        "yes_words": {"bestätigen", "bestatigen", "bestätigt", "ja", "klar", "mach es", "los", "weiter"},
        "no_words": {"abbrechen", "abgebrochen", "nein", "stopp", "stop", "halt", "vergiss es"},
        "stop_phrases": {"hör auf zu hören", "hoer auf zu hoeren", "schalt dich ab", "tschüss", "tschuss"},
        "command_singular": "Befehl",
        "command_plural": "Befehle",
        "done_prefix": "Fertig.",
        "ran_successfully": "erfolgreich ausgeführt.",
        "stopped_prefix": "Auf halbem Weg gestoppt:",
        "failed_word": "fehlgeschlagen",
        "skipped_word": "danach übersprungen",
    },
    "pt": {
        "name": "Português",
        "whisper_code": "pt",
        "ready": "Hey Term pronto.",
        "listening_prompt": "Sim?",
        "not_caught": "Não entendi isso.",
        "canceled": "Cancelado.",
        "ask_confirm": "Diga confirmar para executar, ou cancelar.",
        "unclear_cancel": "Não ouvi um sim ou não claro, então vou cancelar isso. Só pedir de novo se ainda quiser.",
        "requires_typed": "Isso inclui algo da minha lista de não-executar-por-voz, então preciso que você digite CONFIRM para continuar.",
        "typed_confirm_prompt": "Digite CONFIRM (em maiúsculas) para executar esses comandos, ou pressione Enter para cancelar: ",
        "stopping": "Parando. Diga a palavra de ativação quando quiser.",
        "agent_error": "Algo deu errado ao perguntar ao Claude como fazer isso. Veja o terminal para detalhes.",
        "fallback_language_notice": "Ainda não tenho esse idioma traduzido, então vou usar inglês por enquanto.",
        "offline_notice": "Não consigo falar com o Claude agora, então vou usar um comando básico offline para isso.",
        "offline_no_match": "Não consigo falar com o Claude para planejar isso, e não é um dos comandos básicos que sei executar offline.",
        "background_started": "Iniciado em segundo plano. Diga jobs para verificar.",
        "jobs_none": "Ainda não há tarefas em segundo plano.",
        "revert_none": "Nada para reverter.",
        "revert_done": "{n} arquivo(s) revertido(s).",
        "yes_words": {"confirmar", "confirmado", "sim", "vai", "pode", "faça", "faz", "prossiga"},
        "no_words": {"cancelar", "cancelado", "não", "nao", "pare", "para", "esquece"},
        "stop_phrases": {"pare de ouvir", "desliga", "tchau"},
        "command_singular": "comando",
        "command_plural": "comandos",
        "done_prefix": "Pronto.",
        "ran_successfully": "executado(s) com sucesso.",
        "stopped_prefix": "Parou no meio do caminho:",
        "failed_word": "falharam",
        "skipped_word": "foram ignorados depois disso",
    },
    "it": {
        "name": "Italiano",
        "whisper_code": "it",
        "ready": "Hey Term pronto.",
        "listening_prompt": "Sì?",
        "not_caught": "Non ho capito.",
        "canceled": "Annullato.",
        "ask_confirm": "Di' conferma per eseguirlo, o annulla.",
        "unclear_cancel": "Non ho sentito un sì o no chiaro, quindi annullo questo. Chiedimelo di nuovo se lo vuoi ancora.",
        "requires_typed": "Questo include qualcosa nella mia lista di non-eseguire-a-voce, quindi devi digitare CONFIRM per procedere.",
        "typed_confirm_prompt": "Digita CONFIRM (in maiuscolo) per eseguire questi comandi, o premi Invio per annullare: ",
        "stopping": "Mi fermo. Di' la parola di attivazione quando vuoi.",
        "agent_error": "Qualcosa è andato storto chiedendo a Claude come farlo. Controlla il terminale per i dettagli.",
        "fallback_language_notice": "Non ho ancora questa lingua tradotta, quindi userò l'inglese per ora.",
        "offline_notice": "Non riesco a raggiungere Claude in questo momento, quindi uso un comando offline di base per questo.",
        "offline_no_match": "Non riesco a raggiungere Claude per pianificarlo, e non è uno dei comandi di base che posso eseguire offline.",
        "background_started": "Avviato in background. Di' jobs per controllare.",
        "jobs_none": "Ancora nessun lavoro in background.",
        "revert_none": "Niente da annullare.",
        "revert_done": "{n} file ripristinati.",
        "yes_words": {"conferma", "confermato", "sì", "si", "vai", "fallo", "procedi", "certo"},
        "no_words": {"annulla", "annullato", "no", "ferma", "fermati", "stop", "lascia perdere"},
        "stop_phrases": {"smetti di ascoltare", "spegniti", "ciao"},
        "command_singular": "comando",
        "command_plural": "comandi",
        "done_prefix": "Fatto.",
        "ran_successfully": "eseguiti con successo.",
        "stopped_prefix": "Fermato a metà:",
        "failed_word": "falliti",
        "skipped_word": "saltati dopo",
    },
}


def get(language: str) -> dict:
    """Returns the string table for `language`, falling back to English for
    an unknown or untranslated code so the tool never breaks -- it just
    speaks English prompts while still planning/running the request in
    whatever language the person actually spoke.
    """
    return LANGUAGES.get(language, LANGUAGES[DEFAULT_LANGUAGE])


def is_translated(language: str) -> bool:
    return language in LANGUAGES


def list_languages() -> list:
    return sorted(LANGUAGES.keys())
