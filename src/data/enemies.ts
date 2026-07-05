export interface EnemyDef {
  id: string; name: string; emoji: string; floors: [number, number];
  hp: number; mp: number; atk: number; def: number; mag: number; spd: number; lck: number; int: number;
  abilities: string[]; learnableSkill?: string; learnableMagic?: string;
  ai: string; lore: string; isBoss?: boolean;
  intros: string[]; outros: string[];
  xpMult?: number; statGain?: Record<string, number>;
}

const E = (id: string, name: string, emoji: string, floors: [number, number],
  hp: number, atk: number, def: number, mag: number, int: number, spd: number, lck: number, mp: number,
  abilities: string[], ai: string, lore: string,
  intros: string[], outros: string[],
  learnableSkill?: string, learnableMagic?: string,
  isBoss = false, xpMult = 1, statGain?: Record<string, number>): EnemyDef =>
  ({ id, name, emoji, floors, hp, mp, atk, def, mag, int, spd, lck, abilities, ai, lore, isBoss, intros, outros, xpMult, statGain, learnableSkill, learnableMagic });

export const ENEMIES: EnemyDef[] = [
  // 1. Hombre Lobo — dangerous from floor 1
  E('hombre_lobo','Hombre Lobo','🐺',[1,15], 55,16,9,4,3,13,6,5,
    ['claw','howl'],'aggressive','Nacido de la infección que cruzó entre bestia y humano. Ya no recuerda cuál fue primero.',
    ['Ojos amarillos brillan en la oscuridad. El gruñido llega antes que la forma.','Lo hueles antes de verlo. Sangre y pelo mojado.','Se lanza sin aviso. No hay negociación con el hambre.'],
    ['El aullido se apaga. Lo que queda ya no parece ni humano ni bestia.','Cae. Por un instante, su rostro parece humano. Luego ya no.','El cuerpo se desvanece. Sus recuerdos de luna llena se mezclan con los tuyos.'],
    'garra_salvaje','aullido'),
  // 2. Vampiro
  E('vampiro','Vampiro','🧛',[10,30], 40,12,7,10,9,13,10,20,
    ['drain','fade'],'strategic','No nació muerto. Eligió esto. O eso cree.',
    ['Una figura elegante emerge de la penumbra. Su sonrisa revela colmillos.','El aire se enfría. Algo te observa con hambre refinada.','Escuchas una voz sedosa: "No dolerá. Mucho."'],
    ['Se desvanece en ceniza. El frío permanece.','Su última mirada es de sorpresa. No esperaba que pudieras resistirle.','La sangre que derramó se evapora.'],
    'drenar_vida','sombra_vampirica'),
  // 3. Clérigo del Dios Falso
  E('clerigo_falso','Clérigo del Dios Falso','⛪',[20,45], 55,8,12,14,13,6,7,30,
    ['darkHeal','blessCorrupt'],'defensive','Reza a algo que no responde. Pero algo escucha.',
    ['Murmura plegarias en un idioma que no existe. Sus ojos brillan con fe ciega.','Levanta las manos al techo. La torre parece responderle.','Te mira con piedad. La piedad de un verdugo.'],
    ['Cae de rodillas. Su último acto es una oración inacabada.','Su dios no lo salvó. Simplemente no existe.','Los rezos se apagan. El silencio es más honesto.'],
    undefined,'curacion_oscura'),
  // 4. Zombie
  E('zombie','Zombie','🧟',[1,20], 65,12,6,2,1,5,3,0,
    ['bite','revive'],'relentless','Los primeros muertos que se levantaron no entendían que habían muerto.',
    ['Se arrastra hacia ti. Lento. Inevitable.','El olor llega primero. Luego la forma. Luego el hambre en sus ojos vacíos.','Gemidos sin boca. Pasos sin dirección. Pero siempre hacia ti.'],
    ['Cae. Se levanta. Cae de nuevo. Esta vez no se levanta.','El cuerpo deja de moverse. El olor no.','¿Cuántas veces ha muerto esta cosa? Una más, al menos.'],
    'mordida_infecciosa'),
  // 5. Bestia Alada
  E('bestia_alada','Bestia Alada','🦇',[30,55], 50,16,8,12,6,16,8,15,
    ['swoop','windSlash'],'alternating','Nació del bestialismo y la corrupción. Su forma es un insulto a la naturaleza.',
    ['Un aleteo violento sacude el polvo del techo. Algo desciende.','Garras y alas. Demasiadas de ambas.','El viento que trae huele a alturas que no deberían existir dentro de una torre.'],
    ['Las alas se pliegan por última vez. Cae como una piedra con plumas.','El eco de su último chillido rebota entre las paredes.','Algo de su sangre salpica el techo.'],
    'picada_aerea','viento_cortante'),
  // 6. Ángel de Fuego
  E('angel_fuego','Ángel de Fuego','👼',[40,65], 65,10,14,20,18,12,10,30,
    ['holyFlame','sacredShield'],'alternating','No es un ángel. Pero lo fue. El fuego es lo único que conserva de la gracia.',
    ['Una luz que debería ser hermosa pero quema los ojos.','Alas de fuego iluminan el piso. Las sombras huyen de él.','Te mira desde arriba. No con desprecio. Con indiferencia absoluta.'],
    ['Las llamas se extinguen. Lo que queda debajo es irreconocible.','La luz se apaga. La oscuridad se siente más pesada.','Su fuego muere. Pero el calor tarda en irse.'],
    undefined,'llama_divina'),
  // 7. Rueda de Ojos
  E('rueda_ojos','Rueda de Ojos','👁️',[50,75], 45,6,10,16,22,8,18,35,
    ['paralyze','omniscience'],'controller','Ve todo. Comprende nada. Cada ojo parpadea en un tiempo diferente.',
    ['Cientos de ojos te miran simultáneamente. Cada uno ve algo diferente de ti.','Gira. Lentamente. Cada rotación revela más ojos.','No tiene boca. No necesita una. Sus ojos gritan.'],
    ['Los ojos se cierran. Uno por uno. El último te guiña.','Se detiene. Los ojos se opacan como perlas muertas.','Al desvanecerse, juras que uno de los ojos era tuyo.'],
    undefined,'mirada_paralizante'),
  // 8. Querubín en Cólera
  E('querubin','Querubín en Cólera','😇',[50,75], 55,14,12,18,15,14,12,25,
    ['holyWrath','tearHeal'],'berserker','Su rabia es sagrada. O lo era.',
    ['Un rostro infantil distorsionado por la furia. Las lágrimas que caen queman el suelo.','Era bello, alguna vez. La cólera lo hizo otra cosa.','Grita sin sonido. Pero sientes cada palabra en los huesos.'],
    ['La ira se desvanece. Debajo hay algo que parece tristeza.','Cae como un niño dormido. Si ignoras la sangre, parece en paz.','Sus lágrimas dejan marcas luminosas en el suelo.'],
    'ira_santa','lagrimas_luz'),
  // 9. Tetracosa
  E('tetracosa','Tetracosa','🌀',[60,85], 50,12,12,22,20,14,20,30,
    ['distort','chaos'],'chaotic','Nadie sabe qué es. Ni siquiera ella.',
    ['La realidad parpadea. Algo que no debería existir existe.','No la ves llegar. Simplemente está.','El espacio se dobla. Lo que hay en el centro del doblez te mira.'],
    ['Desaparece. O quizás siempre fue invisible.','El espacio se endereza. Tu mente tarda más.','Se va como vino: sin explicación, sin lógica.'],
    undefined,'caos_dimensional'),
  // 10. Falsa Deidad (Boss cada 10 pisos)
  E('falsa_deidad','Falsa Deidad','👑',[10,100], 120,16,18,24,22,10,14,40,
    ['juicioFinal','coronaEspinas','palabraDivina'],'boss','Lo que cayó del cielo. Lo que deformó este lugar. Te mira como quien mira su reflejo.',
    ['El aire se vuelve denso. Algo antiguo despierta.','La temperatura cae. Las paredes tiemblan.','No la ves al principio. Luego la ves en todas partes.'],
    ['Se desvanece. Pero sabes que volverá. Siempre vuelve.','Su forma se disuelve. El eco de su poder permanece.','Te deja ir. No por piedad. Por curiosidad.'],
    undefined,'juicio_final', true, 3, {atk:2,def:2,mag:2}),
  // 11. Lucifer (Boss final piso 100)
  E('lucifer','Lucifer','😈',[100,100], 250,24,22,30,28,16,18,60,
    ['juicioFinal','coronaEspinas','caidaCielo','tronoCenizas'],'devastating','El Caído. El primero. El que demostró que la perfección puede elegir la oscuridad.',
    ['La torre entera tiembla. No de miedo. De reverencia.','Lo reconoces sin haberlo visto jamás.','La belleza más terrible que has visto. Cada detalle es perfecto. Cada detalle está mal.'],
    ['Cae. ¿Qué dice eso de ti?','Su último gesto es una sonrisa. Como si ganar fuera exactamente lo que quería.','El trono se desmorona. Pero no desaparece. Te espera.'],
    'caida_cielo','trono_cenizas', true, 10, {atk:5,def:5,mag:5,mas:5}),
  // 12. Serafín
  E('serafin','Serafín','🕊️',[40,70], 60,12,14,22,20,14,12,30,
    ['blindLight','celestialSong'],'buffBurst','Seis alas. Cuatro cubren su rostro y pies. Las dos que quedan son suficientes.',
    ['La luz que emana no calienta. Congela.','Seis alas se despliegan.','Canta. La melodía es hermosa. Te hace llorar. No de emoción.'],
    ['Las alas se pliegan. La luz se apaga.','Su canto se apaga nota por nota. La última suena a disculpa.','Era lo más cercano a lo divino. Y lo mataste.'],
    undefined,'luz_cegadora'),
  // 13. Humano Enloquecido
  E('humano_loco','Humano Enloquecido','🤪',[5,25], 35,11,5,3,2,10,4,0,
    ['frenzy','scream'],'erratic','Fue como tú. Subió buscando respuestas. Las encontró.',
    ['Te mira con ojos que no enfocan. Ríe. Luego grita. Luego ataca.','Balbucea algo sobre pisos y escaleras que no terminan.','Era un aventurero. Ahora es una advertencia.'],
    ['Cae temblando. Murmura un nombre. No es el suyo.','Por un momento, la cordura regresa a sus ojos. Dice "gracias".','Fue como tú. Recuérdalo.'],
    'frenesi'),
  // 14. Manifestación de Locura
  E('locura','Manifestación de Locura','💀',[25,50], 40,8,8,18,16,12,14,25,
    ['paranoia','fragment'],'chaotic','No es una criatura. Es un estado mental que aprendió a caminar.',
    ['No la ves. La sientes. En tu cabeza. Rascando.','¿Hay algo ahí? ¿O es tu mente inventando enemigos?','Tu propia sombra se retuerce. No es tu sombra.'],
    ['Desaparece. ¿Estuvo ahí realmente? Las heridas dicen que sí.','Se disuelve como un mal pensamiento.','Te preguntas si la mataste o si simplemente dejó de prestarte atención.'],
    undefined,'paranoia_mag'),
  // 15. Sombra Errante
  E('sombra','Sombra Errante','👤',[8,30], 30,10,4,8,7,18,12,10,
    ['frozenTouch','vanish'],'evasive','La sombra de alguien que todavía vive. O vivía.',
    ['Una forma sin detalles. Una silueta que se mueve donde no debería haber nada.','Frío. Un frío que viene de un punto específico en la oscuridad.','No hace ruido. Ni siquiera el ruido de no hacer ruido.'],
    ['Se desvanece. Como una sombra al mediodía.','El frío se va con ella. O casi.','¿De quién era esta sombra?'],
    'toque_gelido'),
  // 16. Códice Poseído
  E('codice','Códice Poseído','📖',[20,45], 35,4,10,16,20,6,10,30,
    ['forbiddenWord','absorbKnow'],'debuffer','Un libro que se abrió solo. Las páginas se escriben mientras lo lees.',
    ['Las páginas pasan solas. Cada una contiene un grito diferente.','Flota. Las palabras que salen de él no están en ningún idioma conocido.','Lo abres por curiosidad. Es el último acto voluntario que realizas por un rato.'],
    ['Se cierra de golpe. Las páginas quedan en blanco. Tu mente no.','Cae al suelo como un libro normal. Pero no lo es.','La última página que ves tiene tu nombre.'],
    undefined,'palabra_prohibida'),
  // 17. Fantasma
  E('fantasma','Fantasma','👻',[10,35], 30,6,6,14,12,14,8,20,
    ['wail','intangible'],'defensive','No sabe que está muerto. No quiere saberlo.',
    ['Un susurro que se convierte en forma.','Atraviesa la pared. Te mira sorprendido.','Llora. No por ti. Por él mismo. Pero las lágrimas queman igual.'],
    ['Se desvanece. Pero el llanto continúa unos segundos más.','Desaparece. Te preguntas si algún día tú también vagarás aquí.','El fantasma se va. El miedo que dejó tarda más en irse.'],
    undefined,'lamento'),
  // 18. Caníbal de Fiebre Amarilla
  E('canibal','Caníbal de Fiebre','🤒',[15,40], 45,13,6,8,10,9,5,10,
    ['feverBite','contagion'],'aggressive','La fiebre le quitó la razón. El hambre le dio propósito.',
    ['Tiembla. Suda. Sonríe. Todo al mismo tiempo.','El calor que emana no es natural.','Te mira con ojos inyectados en sangre. Ve comida.'],
    ['Cae. La fiebre se apaga. El cuerpo se enfría demasiado rápido.','Deja de temblar. Por primera vez, está en paz.','La enfermedad muere con él. O eso esperas.'],
    'mordisco_febril'),
  // 19. Rey Pagano
  E('rey_pagano','Rey Pagano','🤴',[30,55], 70,14,14,12,10,8,10,20,
    ['decree','bloodTribute'],'buffDrain','Gobernó un reino que ya no existe. Sus súbditos tampoco.',
    ['Una corona oxidada sobre una cabeza que ya no merece llevarla.','Se sienta en un trono invisible. Espera que te arrodilles.','Habla con autoridad. Las paredes escuchan.'],
    ['La corona cae. El rey que la usaba ya no importa.','Gobernó en vida. Gobernó en muerte. Ahora no gobierna nada.','Su último decreto es un susurro. Nadie lo obedece.'],
    'decreto_real','tributo_sangre'),
  // 20. Inhumano
  E('inhumano','Inhumano','👹',[35,60], 60,16,12,10,14,10,8,15,
    ['unnaturalBlow','terrorAura'],'debuffer','Se parece a un humano. Eso es lo peor de todo.',
    ['Casi humano. Pero lo que falta es exactamente lo que importa.','Te mira con una cara que conoces. De un sueño. De una pesadilla.','Camina como humano. No es humano.'],
    ['Cae. Por un segundo, parece completamente humano. Eso lo hace peor.','Muere como mueren los humanos. Pero no lo era.','Te preguntas qué diferencia hay entre tú y él.'],
    'golpe_antinatural','aura_terror'),
  // 21. Mutante
  E('mutante','Mutante','🧬',[18,45], 55,15,8,6,4,8,6,10,
    ['aberrantHeal','deformClaw'],'aggressive','La torre lo cambió. Sigue cambiando.',
    ['Su cuerpo no tiene una forma fija. Cambia mientras lo miras.','Brazos de más. Ojos de menos. Sigue moviéndose.','Era algo antes de esto. Ya no importa qué.'],
    ['Deja de cambiar. Se queda en una forma que no es ninguna.','Su cuerpo se relaja en la muerte. Es la primera forma estable.','La mutación continúa incluso muerto. Lo dejas atrás rápidamente.'],
    'zarpa_deforme','regeneracion_aberrante'),
  // 22. Jorobado Pusilánime
  E('jorobado','Jorobado Pusilánime','🥺',[6,25], 30,7,4,3,3,6,8,0,
    ['supplicate','cowardBite'],'passive','Llora mientras pelea. No es un acto.',
    ['Se encoge al verte. Tiembla. Pero no huye.','Murmura disculpas antes de atacar. Parece sincero.','No quiere pelear. Pero la torre no le da opción.'],
    ['Cae. Te mira con ojos que perdonan. No mereces ese perdón.','Su último sonido es un sollozo.','Era débil. Era cobarde. Y tú lo mataste igual.'],
    'suplica'),
  // 23. Hombre de Hojalata
  E('hojalata','Hombre de Hojalata','🤖',[22,48], 70,16,18,2,2,4,4,0,
    ['ironShell','heavyBlow'],'tank','Fue un caballero. La armadura creció hacia dentro.',
    ['Metal rechina contra metal. Cada paso suena como un reloj oxidado.','No queda carne visible. Solo hierro, óxido y voluntad.','Se mueve lento. Pero no se detiene.'],
    ['Cae con un estruendo metálico. Dentro, encuentras huesos.','El metal deja de moverse.','Fue un hombre. Ahora es chatarra.'],
    'golpe_hierro','coraza_oxidada'),
  // 24. Arquero Elfo
  E('arquero_elfo','Arquero Elfo','🏹',[28,52], 38,14,6,8,10,18,14,10,
    ['trueShot','windStep'],'kiter','Los elfos no existen. Pero aquí las reglas son otras.',
    ['Una flecha pasa rozando tu oreja antes de ver a quien la disparó.','Ojos antiguos te evalúan desde la distancia.','Se mueve como el viento. Dispara como la lluvia.'],
    ['Cae en silencio. Incluso muerto, mantiene la elegancia.','Su arco se quiebra al caer.','Los elfos no existen. Pero este está muy muerto.'],
    'flecha_certera','paso_viento'),
  // 25. Espadachín Elfo
  E('espadachin_elfo','Espadachín Elfo','⚔️',[30,55], 42,16,10,6,8,16,10,5,
    ['elfStab','counter'],'counterFighter','Su hoja canta. Una canción triste.',
    ['La espada brilla antes que su dueño se muestre.','Un corte limpio en el aire. Una invitación.','Saluda con la espada. Respeto y amenaza.'],
    ['Su espada cae primero. Él después.','La canción de la hoja se apaga.','Muere con la espada en la mano y la tristeza en los ojos.'],
    'estocada_elfica','contraataque'),
  // 26. Gran Mago Elfo
  E('mago_elfo','Gran Mago Elfo','🧙',[38,60], 45,6,8,22,20,10,12,35,
    ['leafStorm','rootBind'],'controller','La magia élfica no se aprende. Se hereda. Él es el último.',
    ['El aire se llena de hojas que no deberían existir en una torre de piedra.','Susurra al viento. El viento obedece.','Sus ojos brillan verdes. No es un color natural.'],
    ['Las hojas caen. Todas a la vez. Como un bosque muriendo.','El último mago de una raza que quizás nunca existió.','Su magia se apaga como una vela.'],
    undefined,'tormenta_hojas'),
  // 27. Arcanista Mayor Elfo
  E('arcanista_elfo','Arcanista Mayor','🔮',[45,70], 50,6,10,26,24,12,14,40,
    ['arcaneSeal','primalNova'],'nuker','Conoce magias que existían antes de las palabras.',
    ['Los símbolos que lo rodean no son de ningún idioma conocido.','Te silencia con un gesto. Literalmente.','La magia que emana es tan antigua que duele mirarla.'],
    ['Los sellos se rompen. La magia que contenían se dispersa.','Muere susurrando un hechizo que nadie más conocerá.','El último arcanista. La última magia verdadera.'],
    undefined,'nova_primal'),
  // 28. Elfo Extraño
  E('elfo_extrano','Elfo Extraño','🧝',[50,75], 45,10,10,18,18,14,22,25,
    ['gazeOther','distortSong'],'chaotic','No es como los otros elfos. No es como nada.',
    ['Te mira. No con hostilidad. Con curiosidad. Eso es peor.','Tararea algo. La melodía no tiene sentido.','Sonríe como si supiera algo que tú no.'],
    ['Se va. No muere. Simplemente decide irse.','Deja atrás una nota musical que flota en el aire.','Desaparece. Te preguntas si era un enemigo o un espectador.'],
    undefined,'canto_distorsionado'),
  // 29. Merlín?
  E('merlin','Merlín ?','🎭',[55,80], 55,8,12,28,26,10,16,40,
    ['primordialMagic','timePardox'],'strategic','¿El Merlín? No. Pero tampoco no.',
    ['Te mira como quien mira un libro que ya leyó.','El tiempo se ralentiza a su alrededor.','¿Es él? ¿Es una copia? ¿Importa?'],
    ['Desaparece. No muere. Simplemente ya no está en este momento.','Sonríe antes de irse. "Nos veremos."','El tiempo vuelve a fluir normal.'],
    undefined,'magia_primordial'),
  // 30. Armadura Poseída
  E('armadura','Armadura Poseída','🛡️',[20,45], 65,16,20,8,6,4,4,10,
    ['ironStrike','armorCurse'],'heavy','El caballero murió hace siglos. La armadura no lo sabe.',
    ['Vacía por dentro. Llena de intención.','Rechina al moverse. No debería moverse.','El caballero que la usaba ya no está. Algo más ocupa su lugar.'],
    ['Cae pieza por pieza. Dentro no hay nada.','La maldición que la animaba se disipa.','Era solo metal. Metal con memoria y rencor.'],
    'golpe_hierro','maldicion_portador'),
  // 31. Perro Caníbal
  E('perro','Perro Caníbal','🐕',[3,18], 30,12,4,2,2,14,6,0,
    ['rabidBite','howlPack'],'aggressive','Los perros fueron los primeros en morder. Los primeros en cambiar.',
    ['Gruñe bajo. Los dientes que muestra ya no son de perro.','Era una mascota. El collar oxidado lo delata.','Rápido. Hambriento. Infectado.'],
    ['El gruñido se apaga. Lo que queda parece un perro normal.','Muere como un animal. Sin entender por qué.','El collar dice "Leal". La ironía no te hace reír.'],
    'mordida_rabiosa'),
  // 32. Felino Negro
  E('felino','Felino Negro','🐆',[12,35], 28,14,6,6,8,20,16,5,
    ['silentClaw','shadowCat'],'assassin','Te mira con ojos que saben demasiado.',
    ['Dos ojos brillan en la oscuridad. Después desaparecen. Después están más cerca.','No hace ruido. Ninguno.','Los gatos negros traen mala suerte. Este trae algo peor.'],
    ['Se desvanece en las sombras.','Muere en silencio. Como vivió.','Sus ojos se cierran. Los últimos en apagarse.'],
    'zarpa_silenciosa'),
  // 33. Pudú, Gran Brujo
  E('pudu','Pudú, Gran Brujo','🦌',[42,65], 50,6,10,24,22,8,14,35,
    ['australSpell','ritualSur'],'resilient','Un pequeño ciervo con poderes inmensos. La naturaleza tiene sentido del humor.',
    ['Un ciervo diminuto. Te mira desde abajo con ojos que contienen siglos.','La tierra tiembla bajo sus pezuñas. Tan pequeño. Tan poderoso.','Viene del sur. De un lugar donde la magia huele a bosque húmedo.'],
    ['El pequeño brujo cae. El bosque que traía consigo se marchita.','Muere dignamente. Como mueren los antiguos.','Era pequeño. Su magia no. Recuérdalo.'],
    undefined,'encantamiento_austral'),
  // 34. Coipo el Copiador
  E('coipo','Coipo el Copiador','🦫',[35,60], 45,12,10,12,12,12,14,15,
    ['mimic','adapt'],'mirror','Te imita. Perfectamente. Eso debería preocuparte.',
    ['Te mira fijamente. Luego hace exactamente lo que acabas de hacer.','No tiene forma propia. Toma la tuya.','Luchas contra ti mismo. Él es mejor en eso.'],
    ['Pierde tu forma al morir. Lo que queda debajo no se parece a nada.','Muere siendo tú. Profundamente perturbador.','Deja de copiar. Solo queda el original. ¿Verdad?'],
    'mimetismo'),
  // 35. Portador de Peste
  E('portador_peste','Portador de Peste','🦠',[25,50], 50,8,8,14,12,8,6,15,
    ['toxicCloud','immunePath'],'statusStacker','Camina en su propia plaga. Sonríe.',
    ['El aire se vuelve visible a su alrededor. Verde. Espeso. Mortal.','Tose. Cada tos es una sentencia.','Sonríe. Los que sonríen en este lugar siempre son los peores.'],
    ['Cae. La nube se disipa lentamente. No respires.','Muere, pero la enfermedad sigue viva en el aire.','Era un contenedor. Ahora que se rompió, ¿a dónde irá lo que contenía?'],
    undefined,'nube_toxica'),
  // 36. Maestro de Pestes
  E('maestro_pestes','Maestro de Pestes','☠️',[40,65], 55,10,10,18,18,8,10,25,
    ['majorPlague','inoculate'],'debuffMaster','No crea las enfermedades. Las perfecciona.',
    ['Huele a laboratorio y a fosa común.','Lleva frascos. Todos contienen algo que no quieres conocer.','Te examina con ojos clínicos.'],
    ['Sus frascos se rompen al caer. Aléjate del charco.','La peste muere con el maestro. O eso esperas.','Conocía cada enfermedad. No conocía la derrota.'],
    undefined,'plaga_mayor'),
  // 37. Creador de Virus
  E('creador_virus','Creador de Virus','🧪',[55,80], 48,8,8,22,24,10,12,30,
    ['mutantStrain','pandemic'],'layerer','La enfermedad perfecta es la que evoluciona. Como él.',
    ['Toma notas. Sobre ti. Sobre tu dolor. Para mejorar.','Cada virus es un hijo. Cada pandemia, una obra maestra.','Te mira como un artista mira un lienzo en blanco.'],
    ['Su última creación muere con él. O quizás ya la soltó.','Las notas que deja contienen horrores. Y soluciones.','El creador cae. Pero las creaciones sobreviven.'],
    undefined,'cepa_mutante'),
  // 38. Mujer Amable (trampa narrativa)
  E('mujer_amable','Mujer Amable','🙂',[45,70], 40,6,8,20,18,6,20,20,
    ['kindSmile','maternalEmbrace'],'trap','Es amable. Genuinamente. Eso la hace más peligrosa que cualquier bestia.',
    ['Sonríe. Genuinamente. En este lugar, eso te aterra más que cualquier monstruo.','Te ofrece la mano. Nadie ha sido amable contigo en mucho tiempo.','"¿Estás bien?", pregunta. Su preocupación es real. Todo lo demás también.'],
    ['Cae sin dejar de sonreír. No te culpa. Tú te culpas.','Su última palabra es tu nombre. No sabes cómo lo conocía.','Era amable. Fue amable hasta el final. Y tú la mataste igual.'],
    'suplica'),
  // 39. Fieras
  E('fieras','Fieras','🐗',[15,40], 50,15,10,3,2,12,6,0,
    ['savageCharge','killerInstinct'],'aggressive','No tiene nombre. No necesita uno.',
    ['Gruñe. Es un sonido que viene del estómago.','Carga sin aviso. Sin estrategia. Solo fuerza.','Los ojos rojos no parpadean.'],
    ['Cae pesadamente. El suelo tiembla un poco.','Muere como vivió: con violencia y sin complejidad.','Era una máquina de matar. Ahora es carne muerta.'],
    'embestida_salvaje'),
  // 40. Gran León Negro
  E('leon_negro','Gran León Negro','🦁',[48,75], 80,20,14,6,6,14,10,10,
    ['abyssRoar','kingClaw'],'alpha','El rey de bestias que no deberían existir.',
    ['Negro como la ausencia de luz. Grande como tu miedo.','Ruge. Las paredes devuelven el eco multiplicado.','Te mira como un rey mira a un súbdito.'],
    ['El rey cae. Su melena negra se extiende como sombra derramada.','Muere en silencio. Los reyes no gritan.','Era el más fuerte aquí. Hasta que llegaste tú.'],
    'rugido_abismo','garra_rey'),
  // 41. Cazador Bestia
  E('cazador','Cazador Bestia','🏹',[20,48], 45,16,8,4,8,14,10,5,
    ['steelTrap','preciseShot'],'trapper','Vino a cazar bestias. Ahora es una.',
    ['La trampa se cierra antes de ver a quien la puso.','Ojos de cazador. Ya no distingue presa de persona.','Fue humano. El instinto de caza lo consumió.'],
    ['Cae. Su trampa se cierra sobre su propia mano.','Cazó toda su vida. Ahora es la presa.','Muere con los ojos abiertos. Todavía buscando.'],
    'trampa_acero','disparo_certero'),
  // 42. Oso de Garras Curvas
  E('oso','Oso de Garras Curvas','🐻',[32,58], 85,18,16,2,2,4,4,0,
    ['bearHug','thickHide'],'devastator','Sus garras crecieron hacia dentro. Cada golpe también lo hiere a él.',
    ['Grande. Más grande de lo que debería ser. Las garras curvan como ganchos.','El suelo cruje bajo su peso. Se acerca despacio.','Huele a sangre vieja y a miel fermentada.'],
    ['Cae como un árbol. El impacto retumba pisos abajo.','Sus garras curvas quedan enterradas en el suelo.','Era enorme. Ahora es un montón de pelo y silencio.'],
    'abrazo_oso'),
  // 43. El Cuervo
  E('cuervo','El Cuervo','🐦',[18,42], 25,12,4,10,14,20,18,10,
    ['omenPeck','presage'],'luckDestroyer','Donde va el cuervo, llega la desgracia.',
    ['Un graznido. Luego otro. Luego silencio. Luego garras.','Negro sobre negro. Solo los ojos brillan.','Dicen que los cuervos recuerdan las caras. Este recuerda las almas.'],
    ['Una pluma negra cae flotando. La recoges sin saber por qué.','El cuervo cae. Pero otros cuervos graznean en la distancia.','La mala suerte que traía no se va con él.'],
    'picotazo_agorero','presagio'),
  // 44. Sol Huracanado
  E('sol','Sol Huracanado','☀️',[60,85], 60,8,12,28,24,6,8,35,
    ['solarCorona','solarGravity'],'artillery','Un fragmento de estrella atrapado en la torre. Gira. Quema. No comprende.',
    ['El calor es insoportable antes de verlo. Cuando lo ves, es peor.','Gira. Lentamente. Como un sol que olvidó cómo alumbrar sin quemar.','No debería existir bajo techo.'],
    ['Se apaga. El frío que lo reemplaza es casi tan doloroso.','Muere como una estrella: colapsando hacia dentro.','El fuego se extingue. Las quemaduras no.'],
    undefined,'corona_solar'),
  // 45. Niño Hambriento (moral weight)
  E('nino','Niño Hambriento','👦',[10,35], 20,6,3,2,4,12,10,0,
    ['guiltyPlea','desperateBite'],'thief','Tiene hambre. Solo hambre. Pero en este lugar, el hambre tiene dientes.',
    ['Es un niño. Solo un niño. Con ojos demasiado grandes y manos demasiado delgadas.','Te pide comida. Su voz es pequeña. Sus dientes no.','No debería estar aquí. Pero tú tampoco.'],
    ['Cae. Es pequeño. Pesa poco. El remordimiento pesa más.','Su última mirada es de confusión. No entiende por qué le hiciste daño.','Se va. No estás seguro de haberlo matado.'],
    'suplica'),

  // ========= DARK CLASSES (BOSSES / UNLOCKS) =========
  E('paladin_oscuro','Paladín Oscuro','🛡️',[20,20], 85,14,16,14,14,10,10,40,
    ['holyJudge','protectAura'],'boss','Un paladín cuya fe fue corrompida por la torre. Su luz ahora es negra.',
    ['Su armadura brilla con luz oscura. Reza un himno blasfemo.','El Paladín Oscuro levanta su espada. "La luz murió aquí", susurra.','Una presencia sagrada y corrupta bloquea tu camino.'],
    ['El Paladín Oscuro cae. Su armadura se quiebra y libera un fulgor limpio.','Al morir, murmura una verdadera oración. Su alma es liberada.','La corrupción abandona su cuerpo. Has redimido al Paladín.'],
    'golpe_pesado','rayo_sagrado', true, 3, {atk:2,def:2,mag:2}),

  E('guerrero_oscuro','Guerrero Oscuro','⚔️',[40,40], 140,22,14,6,6,14,12,20,
    ['fury','execute'],'boss','Un bruto implacable que se entregó a la sed de sangre eterna de la torre.',
    ['Grita con furia berserker. Su espada chorrea sangre de exploradores anteriores.','El Guerrero Oscuro golpea su pecho. "¡MÁS SANGRE!", ruge.','No busca gloria. Solo busca destruirte.'],
    ['El Guerrero Oscuro se arrodilla, jadeando. "Una buena muerte...", susurra.','Su arma cae de sus manos. La sed de sangre se extingue por fin.','Cae el titán. Su fuerza bruta ahora te inspira.'],
    'embate_furioso','frenesi', true, 4, {atk:3,def:2,spd:2}),

  E('brujo_oscuro','Brujo Oscuro','🔮',[60,60], 160,10,12,30,28,14,16,80,
    ['eternalCurse','darkSummon'],'boss','Maestro del caos que se fusionó con los demonios del abismo.',
    ['Sombras orbitan a su alrededor. Te mira con ojos que contienen galaxias muertas.','El Brujo Oscuro sonríe. "El vacío reclama todo", susurra.','La gravedad se distorsiona en su presencia.'],
    ['Las sombras lo consumen a él mismo. "El abismo... me llama..."','El Brujo Oscuro se disuelve en el caos que conjuró.','Al morir, sus arcanos prohibidos quedan grabados en tu mente.'],
    'corte_sangriento','maldicion', true, 5, {mag:4,int:4,lck:2}),
];

export const ENEMY_EMOJI: Record<string, string> = {};
ENEMIES.forEach(e => { ENEMY_EMOJI[e.id] = e.emoji; });

export function getEnemiesForFloor(floor: number): EnemyDef[] {
  return ENEMIES.filter(e => !e.isBoss && floor >= e.floors[0] && floor <= e.floors[1]);
}

export function getBossForFloor(floor: number): EnemyDef | undefined {
  if (floor === 10) return ENEMIES.find(e => e.id === 'hojalata');
  if (floor === 20) return ENEMIES.find(e => e.id === 'paladin_oscuro');
  if (floor === 30) return ENEMIES.find(e => e.id === 'leon_negro');
  if (floor === 40) return ENEMIES.find(e => e.id === 'guerrero_oscuro');
  if (floor === 50) return ENEMIES.find(e => e.id === 'serafin');
  if (floor === 60) return ENEMIES.find(e => e.id === 'brujo_oscuro');
  if (floor === 70) return ENEMIES.find(e => e.id === 'tetracosa');
  if (floor === 80) return ENEMIES.find(e => e.id === 'merlin');
  if (floor === 90) return ENEMIES.find(e => e.id === 'falsa_deidad');
  if (floor === 100) return ENEMIES.find(e => e.id === 'lucifer');
  return undefined;
}

export function scaleEnemy(e: EnemyDef, floor: number, playerLevel = 1): EnemyDef {
  // Tower is BRUTAL — enemies are always a threat
  const floorScale = 1 + (floor - e.floors[0]) * 0.09;
  // Enemy level matches player aggressively
  const levelScale = 1 + Math.max(0, playerLevel - 1) * 0.05;
  // Depth makes everything worse
  const depthBonus = 1 + floor * 0.012;
  const scale = floorScale * levelScale * depthBonus;
  // Boss multiplier — bosses are terrifying
  const bossMult = e.isBoss ? 1.8 : 1;
  return { ...e,
    hp: Math.round(e.hp * scale * bossMult),
    atk: Math.round(e.atk * scale),
    def: Math.round(e.def * scale),
    mag: Math.round(e.mag * scale),
    spd: Math.round(e.spd * Math.min(scale, 1.8)), // SPD caps scaling
    mp: Math.round(e.mp * scale),
  };
}
