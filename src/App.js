import { useState, useMemo } from "react";

// ─────────────────────────────────────────────
// DATA & CALCULATIONS
// ─────────────────────────────────────────────

const stepTitles = ["Perfil", "Objetivo", "Entreno", "Comidas", "Suplementos", "Tu Dieta"];
const initialForm = {
  sex:"", age:"", weight:"", height:"", bodyFat:"", goal:"",
  trainingDays:"", trainingLevel:"", trainTime:"", dietType:"omnivore", allergies:"",
  mealsPerDay:"", wheyProtein:false, wheyGrams:"", creatine:false, bcaa:false, other:"",
};

const isMale = sex => sex === "male";

function estimateBodyFat(sex,age,weight,height){
  if(!sex||!age||!weight||!height) return null;
  const bmi=parseFloat(weight)/((parseFloat(height)/100)**2);
  const bf=isMale(sex)?(1.20*bmi)+(0.23*parseFloat(age))-16.2:(1.20*bmi)+(0.23*parseFloat(age))-5.4;
  return Math.max(5,Math.min(55,Math.round(bf)));
}

function calcMacros(form,estBF){
  const w=parseFloat(form.weight),h=parseFloat(form.height),a=parseFloat(form.age),male=isMale(form.sex);
  const days=parseInt(form.trainingDays)||4;
  const bf=parseFloat(form.bodyFat)||estBF||(male?18:25);
  const lbm=w*(1-bf/100);
  const bmr=370+21.6*lbm;
  const tdee=Math.round(bmr*({3:1.375,4:1.55,5:1.55,6:1.725}[days]||1.55));
  let adj=form.goal==="muscle"?(male?350:250):form.goal==="fat_loss"?(male?-450:-350):0;
  const kcal=Math.max(1200,Math.round(tdee+adj));
  let pf=form.goal==="fat_loss"?2.4:form.goal==="muscle"?2.1:1.8;
  if(!male)pf-=0.1; if(a>=40)pf+=0.1; if(a>=60)pf+=0.2;
  if(form.trainingLevel==="advanced")pf=Math.min(pf+0.1,2.6);
  const totalProt=Math.round(w*pf);
  const fat=Math.round(w*(form.goal==="fat_loss"?0.9:1.1));
  const carbs=Math.max(50,Math.round((kcal-totalProt*4-fat*9)/4));
  const suppProtein=form.wheyProtein&&form.wheyGrams?parseFloat(form.wheyGrams)||0:0;
  const foodProt=Math.max(0,totalProt-suppProtein);
  // Keto override: carbs ≤30g, fat fills remaining kcal
  let finalCarbs=carbs, finalFat=fat;
  if(form.dietType==="keto"){
    finalCarbs=Math.min(carbs,25);
    finalFat=Math.round((kcal-totalProt*4-finalCarbs*4)/9);
  }
  return{kcal,tdee,totalProt,foodProt,suppProtein,fat:finalFat,carbs:finalCarbs,lbm:Math.round(lbm),bf:Math.round(bf),isKeto:form.dietType==="keto"};
}

// Macro category databases (per 100g)
const PROTEIN_SOURCES = {
  omnivore:[
    {name:"Pechuga de pollo",p:31,c:0,f:3.6,emoji:"🍗"},
    {name:"Pechuga de pavo",p:29,c:0,f:2,emoji:"🦃"},
    {name:"Atún al natural",p:26,c:0,f:1,emoji:"🐟"},
    {name:"Salmón",p:20,c:0,f:13,emoji:"🐠"},
    {name:"Merluza",p:20,c:0,f:1.5,emoji:"🐟"},
    {name:"Carne picada 5%",p:21,c:0,f:5,emoji:"🥩"},
    {name:"Huevos enteros",p:13,c:1,f:11,emoji:"🥚",note:"1 huevo≈60g"},
    {name:"Claras de huevo",p:11,c:0.7,f:0.2,emoji:"🥚",note:"1 clara≈30g"},
    {name:"Requesón 0%",p:11,c:4,f:0.2,emoji:"🧀"},
    {name:"Yogur griego 0%",p:10,c:4,f:0.3,emoji:"🥛"},
    {name:"Jamón serrano",p:24,c:0,f:6,emoji:"🥩"},
    {name:"Leche desnatada",p:3.4,c:4.9,f:0.1,emoji:"🥛"},
    {name:"Leche semidesnatada",p:3.3,c:4.8,f:1.5,emoji:"🥛"},
  ],
  vegetarian:[
    {name:"Huevos enteros",p:13,c:1,f:11,emoji:"🥚",note:"1 huevo≈60g"},
    {name:"Claras de huevo",p:11,c:0.7,f:0.2,emoji:"🥚",note:"1 clara≈30g"},
    {name:"Requesón 0%",p:11,c:4,f:0.2,emoji:"🧀"},
    {name:"Yogur griego 0%",p:10,c:4,f:0.3,emoji:"🥛"},
    {name:"Tofu firme",p:17,c:2,f:9,emoji:"🟡"},
    {name:"Tempeh",p:19,c:9,f:11,emoji:"🟤"},
    {name:"Lentejas cocidas",p:9,c:20,f:0.4,emoji:"🫘"},
    {name:"Garbanzos cocidos",p:8.9,c:27,f:2.6,emoji:"🫘"},
  ],
  vegan:[
    {name:"Tofu firme",p:17,c:2,f:9,emoji:"🟡"},
    {name:"Tempeh",p:19,c:9,f:11,emoji:"🟤"},
    {name:"Seitán",p:25,c:14,f:1.9,emoji:"🫓"},
    {name:"Lentejas cocidas",p:9,c:20,f:0.4,emoji:"🫘"},
    {name:"Garbanzos cocidos",p:8.9,c:27,f:2.6,emoji:"🫘"},
    {name:"Edamame",p:11,c:10,f:5,emoji:"🫛"},
    {name:"Alubias negras cocidas",p:8.9,c:23,f:0.5,emoji:"🫘"},
  ],
};
const CARB_SOURCES=[
  {name:"Arroz blanco cocido",p:2.7,c:28,f:0.3,emoji:"🍚"},
  {name:"Arroz integral cocido",p:2.6,c:23,f:0.9,emoji:"🍚"},
  {name:"Avena en copos",p:13,c:66,f:7,emoji:"🌾"},
  {name:"Patata cocida",p:2,c:17,f:0.1,emoji:"🥔"},
  {name:"Boniato cocido",p:1.6,c:20,f:0.1,emoji:"🍠"},
  {name:"Pasta integral cocida",p:5,c:25,f:1,emoji:"🍝"},
  {name:"Pan integral tostado",p:9,c:41,f:3,emoji:"🍞"},
  {name:"Pan blanco",p:8,c:52,f:1.5,emoji:"🍞"},
  {name:"Pan proteico tostado",p:15,c:35,f:5,emoji:"🍞",note:"alta proteína"},
  {name:"Pan proteico low carb",p:22,c:8,f:8,emoji:"🍞",note:"≈4g net carb/100g"},
  {name:"Pan de centeno",p:8.5,c:48,f:2.6,emoji:"🍞"},
  {name:"Quinoa cocida",p:4.4,c:22,f:1.9,emoji:"🌿"},
  {name:"Plátano",p:1,c:23,f:0.3,emoji:"🍌"},
  {name:"Manzana",p:0.3,c:14,f:0.2,emoji:"🍎"},
];
const FAT_SOURCES=[
  {name:"Aceite de oliva virgen extra",p:0,c:0,f:100,emoji:"🫒"},
  {name:"Aguacate",p:2,c:9,f:15,emoji:"🥑"},
  {name:"Almendras",p:21,c:22,f:49,emoji:"🌰"},
  {name:"Nueces",p:15,c:14,f:65,emoji:"🌰"},
  {name:"Anacardos",p:18,c:30,f:44,emoji:"🌰"},
  {name:"Mantequilla de cacahuete",p:25,c:20,f:50,emoji:"🥜"},
  {name:"Huevo entero (yema)",p:13,c:1,f:11,emoji:"🥚",note:"1 huevo≈60g"},
  {name:"Queso parmesano",p:36,c:0,f:26,emoji:"🧀"},
  {name:"Mantequilla",p:0.5,c:0,f:83,emoji:"🧈"},
];

function getMealSchedule(trainTime,n){
  const s={
    morning:{
      3:[{name:"Desayuno",type:"breakfast",note:"pre-entreno"},{name:"Almuerzo",type:"lunch"},{name:"Cena",type:"dinner"}],
      4:[{name:"Desayuno",type:"breakfast",note:"pre-entreno"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack"},{name:"Cena",type:"dinner"}],
      5:[{name:"Desayuno",type:"breakfast",note:"pre-entreno"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack"},{name:"Cena",type:"dinner"}],
      6:[{name:"Desayuno",type:"breakfast",note:"pre-entreno"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack"},{name:"Cena",type:"dinner"},{name:"Recena Proteica",type:"evening_snack"}],
    },
    afternoon:{
      3:[{name:"Desayuno",type:"breakfast"},{name:"Almuerzo",type:"lunch"},{name:"Cena",type:"dinner",note:"post-entreno"}],
      4:[{name:"Desayuno",type:"breakfast"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack",note:"pre-entreno"},{name:"Cena",type:"dinner",note:"post-entreno"}],
      5:[{name:"Desayuno",type:"breakfast"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack",note:"pre-entreno"},{name:"Cena",type:"dinner",note:"post-entreno"}],
      6:[{name:"Desayuno",type:"breakfast"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack",note:"pre-entreno"},{name:"Cena",type:"dinner",note:"post-entreno"},{name:"Recena Proteica",type:"evening_snack"}],
    },
    evening:{
      3:[{name:"Desayuno",type:"breakfast"},{name:"Almuerzo",type:"lunch"},{name:"Cena",type:"dinner",note:"post-entreno"}],
      4:[{name:"Desayuno",type:"breakfast"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack",note:"pre-entreno"},{name:"Cena",type:"dinner",note:"post-entreno"}],
      5:[{name:"Desayuno",type:"breakfast"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack",note:"pre-entreno"},{name:"Cena",type:"dinner",note:"post-entreno"}],
      6:[{name:"Desayuno",type:"breakfast"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch"},{name:"Merienda",type:"snack",note:"pre-entreno"},{name:"Cena",type:"dinner",note:"post-entreno"},{name:"Post-Entreno",type:"evening_snack"}],
    },
    midday:{
      3:[{name:"Desayuno",type:"breakfast"},{name:"Almuerzo",type:"lunch",note:"pre-entreno"},{name:"Cena",type:"dinner",note:"post-entreno"}],
      4:[{name:"Desayuno",type:"breakfast"},{name:"Almuerzo",type:"lunch",note:"pre-entreno"},{name:"Merienda",type:"snack",note:"post-entreno"},{name:"Cena",type:"dinner"}],
      5:[{name:"Desayuno",type:"breakfast"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch",note:"pre-entreno"},{name:"Merienda",type:"snack",note:"post-entreno"},{name:"Cena",type:"dinner"}],
      6:[{name:"Desayuno",type:"breakfast"},{name:"Media Mañana",type:"mid_morning"},{name:"Almuerzo",type:"lunch",note:"pre-entreno"},{name:"Merienda",type:"snack",note:"post-entreno"},{name:"Cena",type:"dinner"},{name:"Recena Proteica",type:"evening_snack"}],
    },
  };
  return (s[trainTime]||s.afternoon)[n]||(s.afternoon)[4];
}

function getFoodTemplates(dietType){
  const omni={
    breakfast:[
      {name:"Tostadas con jamón serrano y café",items:[
        {name:"Pan integral tostado",grams:80,p:7.2,c:32.8,f:2.4,cat:"carb",note:"2 rebanadas"},
        {name:"Jamón serrano",grams:60,p:14.4,c:0,f:3.6,cat:"protein"},
        {name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"},
        {name:"Café con leche desnatada",grams:200,p:6.8,c:9.8,f:0.2,cat:"protein",note:"200ml leche desnatada"},
      ]},
      {name:"Huevos revueltos con tostadas y café",items:[
        {name:"Huevos enteros",grams:180,p:21.6,c:1.8,f:19.8,cat:"protein",note:"≈3 huevos"},
        {name:"Pan integral tostado",grams:60,p:5.4,c:24.6,f:1.8,cat:"carb",note:"2 rebanadas"},
        {name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"},
        {name:"Café solo o con leche desnatada",grams:0,p:0,c:0,f:0,cat:"veg",note:"sin límite"},
      ]},
      {name:"Tostadas con mantequilla y mermelada",items:[
        {name:"Pan proteico tostado",grams:80,p:12,c:28,f:4,cat:"carb",note:"2 rebanadas pan proteico"},
        {name:"Mantequilla",grams:15,p:0.1,c:0,f:12.4,cat:"fat"},
        {name:"Yogur griego 0%",grams:200,p:20,c:8,f:0.6,cat:"protein"},
        {name:"Café con leche semidesnatada",grams:200,p:5,c:9.4,f:1.8,cat:"protein",note:"200ml leche semi"},
      ]},
      {name:"Bowl de avena con leche y fruta",items:[
        {name:"Avena en copos",grams:70,p:9.1,c:46.2,f:4.9,cat:"carb"},
        {name:"Leche desnatada",grams:250,p:8.5,c:12.3,f:0.3,cat:"protein"},
        {name:"Plátano",grams:100,p:1,c:23,f:0.3,cat:"carb"},
        {name:"Almendras",grams:15,p:3.2,c:3.3,f:7.4,cat:"fat"},
      ]},
      {name:"Tostadas con aceite y tomate al estilo español",items:[
        {name:"Pan integral tostado",grams:90,p:8.1,c:36.9,f:2.7,cat:"carb",note:"2-3 rebanadas"},
        {name:"Aceite de oliva virgen extra",grams:15,p:0,c:0,f:15,cat:"fat"},
        {name:"Tomate rallado",grams:80,p:0.6,c:3.1,f:0.2,cat:"veg"},
        {name:"Jamón serrano o pavo",grams:70,p:16.1,c:0.3,f:3.2,cat:"protein"},
        {name:"Café con leche desnatada",grams:200,p:6.8,c:9.8,f:0.2,cat:"protein",note:"200ml leche desnatada"},
      ]},
      {name:"Tortilla francesa con pan y café",items:[
        {name:"Huevos enteros",grams:120,p:14.4,c:1.2,f:13.2,cat:"protein",note:"≈2 huevos"},
        {name:"Claras de huevo",grams:90,p:9.9,c:0.6,f:0.2,cat:"protein",note:"≈3 claras extra"},
        {name:"Pan integral tostado",grams:60,p:5.4,c:24.6,f:1.8,cat:"carb",note:"2 rebanadas"},
        {name:"Aceite de oliva virgen extra",grams:8,p:0,c:0,f:8,cat:"fat"},
        {name:"Café con leche desnatada",grams:200,p:6.8,c:9.8,f:0.2,cat:"protein",note:"200ml leche desnatada"},
      ]},
    ],
    mid_morning:[
      {name:"Requesón con fruta y frutos secos",items:[{name:"Requesón 0%",grams:200,p:22,c:8,f:0.4,cat:"protein"},{name:"Manzana",grams:150,p:0.5,c:21,f:0.3,cat:"carb"},{name:"Nueces",grams:20,p:3,c:2.8,f:13,cat:"fat"}]},
      {name:"Yogur griego con avena",items:[{name:"Yogur griego 0%",grams:200,p:20,c:8,f:0.6,cat:"protein"},{name:"Avena en copos",grams:30,p:3.9,c:19.8,f:2.1,cat:"carb"},{name:"Plátano",grams:80,p:0.8,c:18.4,f:0.2,cat:"carb"}]},
      {name:"Tostada con pavo y aguacate",items:[{name:"Pechuga de pavo loncheada",grams:80,p:23.2,c:0.8,f:1.6,cat:"protein"},{name:"Pan integral tostado",grams:60,p:5.4,c:24.6,f:1.8,cat:"carb"},{name:"Aguacate",grams:50,p:1,c:4.5,f:7.5,cat:"fat"}]},
    ],
    lunch:[
      {name:"Pollo a la plancha con arroz",items:[{name:"Pechuga de pollo a la plancha",grams:200,p:62,c:0,f:7.2,cat:"protein"},{name:"Arroz blanco cocido",grams:200,p:5.4,c:56,f:0.6,cat:"carb"},{name:"Brócoli al vapor",grams:150,p:5.3,c:7,f:0.6,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
      {name:"Salmón al horno con patata",items:[{name:"Salmón al horno",grams:180,p:36,c:0,f:23.4,cat:"protein"},{name:"Patata cocida",grams:200,p:4,c:34,f:0.2,cat:"carb"},{name:"Ensalada variada",grams:150,p:1.5,c:5,f:0.3,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:8,p:0,c:0,f:8,cat:"fat"}]},
      {name:"Carne picada con pasta integral",items:[{name:"Carne picada 5%",grams:180,p:37.8,c:0,f:9,cat:"protein"},{name:"Pasta integral cocida",grams:200,p:10,c:50,f:2,cat:"carb"},{name:"Tomate frito casero",grams:80,p:1.2,c:6.4,f:2.4,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:8,p:0,c:0,f:8,cat:"fat"}]},
      {name:"Atún con ensalada de arroz",items:[{name:"Atún al natural",grams:160,p:41.6,c:0,f:1.6,cat:"protein"},{name:"Arroz blanco cocido",grams:180,p:4.9,c:50.4,f:0.5,cat:"carb"},{name:"Pimientos y pepino",grams:120,p:1,c:5,f:0.2,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
    ],
    snack:[
      {name:"Yogur griego con plátano y almendras",items:[{name:"Yogur griego 0%",grams:150,p:15,c:6,f:0.5,cat:"protein"},{name:"Plátano",grams:100,p:1,c:23,f:0.3,cat:"carb"},{name:"Almendras",grams:20,p:4.2,c:4.4,f:9.8,cat:"fat"}]},
      {name:"Tostada con pavo y requesón",items:[{name:"Pechuga de pavo loncheada",grams:80,p:23.2,c:0.8,f:1.6,cat:"protein"},{name:"Pan integral tostado",grams:60,p:5.4,c:24.6,f:1.8,cat:"carb"},{name:"Requesón 0%",grams:80,p:8.8,c:3.2,f:0.2,cat:"protein"}]},
      {name:"Arroz con atún y aguacate",items:[{name:"Atún al natural",grams:120,p:31.2,c:0,f:1.2,cat:"protein"},{name:"Arroz blanco cocido",grams:150,p:4.1,c:42,f:0.5,cat:"carb"},{name:"Aguacate",grams:50,p:1,c:4.5,f:7.5,cat:"fat"}]},
    ],
    dinner:[
      {name:"Merluza al horno con verduras",items:[{name:"Merluza al horno",grams:200,p:40,c:0,f:3,cat:"protein"},{name:"Patata cocida",grams:150,p:3,c:25.5,f:0.2,cat:"carb"},{name:"Calabacín y pimiento asado",grams:200,p:2.4,c:8,f:0.6,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
      {name:"Tortilla de claras con ensalada",items:[{name:"Claras de huevo",grams:240,p:26.4,c:1.7,f:0.5,cat:"protein",note:"≈8 claras"},{name:"Huevo entero",grams:60,p:7.8,c:0.6,f:6.6,cat:"protein",note:"1 huevo"},{name:"Ensalada variada",grams:150,p:1.5,c:5,f:0.3,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
      {name:"Pollo al horno con arroz y verduras",items:[{name:"Contramuslo de pollo sin piel",grams:180,p:33.5,c:0,f:9,cat:"protein"},{name:"Arroz blanco cocido",grams:150,p:4.1,c:42,f:0.5,cat:"carb"},{name:"Judías verdes salteadas",grams:150,p:2.6,c:5.4,f:0.3,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
      {name:"Ensalada de pollo con aguacate",items:[{name:"Pechuga de pollo a la plancha",grams:200,p:62,c:0,f:7.2,cat:"protein"},{name:"Mezcla de lechuga y espinacas",grams:120,p:1.2,c:3.6,f:0.2,cat:"veg"},{name:"Aguacate",grams:80,p:1.6,c:7.2,f:12,cat:"fat"},{name:"Tomate cherry",grams:80,p:0.6,c:3.2,f:0.2,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:8,p:0,c:0,f:8,cat:"fat"}]},
    ],
    evening_snack:[
      {name:"Requesón con almendras",items:[{name:"Requesón 0%",grams:200,p:22,c:8,f:0.4,cat:"protein"},{name:"Almendras",grams:20,p:4.2,c:4.4,f:9.8,cat:"fat"}]},
      {name:"Yogur griego con nueces",items:[{name:"Yogur griego 0%",grams:200,p:20,c:8,f:0.6,cat:"protein"},{name:"Nueces",grams:20,p:3,c:2.8,f:13,cat:"fat"}]},
    ],
  };
  if(dietType==="vegetarian") return {...omni, lunch:[
    {name:"Tofu salteado con arroz y verduras",items:[{name:"Tofu firme",grams:200,p:34,c:4,f:18,cat:"protein"},{name:"Arroz blanco cocido",grams:200,p:5.4,c:56,f:0.6,cat:"carb"},{name:"Brócoli salteado",grams:150,p:3.5,c:7,f:1,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
    {name:"Lentejas con verduras",items:[{name:"Lentejas cocidas",grams:250,p:22.5,c:50,f:1,cat:"protein"},{name:"Zanahoria y puerro",grams:100,p:1,c:8,f:0.2,cat:"veg"},{name:"Pan integral",grams:50,p:4.5,c:20.5,f:1.5,cat:"carb"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
    {name:"Tortilla de huevos con patatas",items:[{name:"Huevos enteros",grams:180,p:23.4,c:1.8,f:19.8,cat:"protein",note:"≈3 huevos"},{name:"Patata cocida",grams:200,p:4,c:34,f:0.2,cat:"carb"},{name:"Pimiento y cebolla",grams:100,p:1,c:6,f:0.5,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
  ]};
  if(dietType==="vegan") return {...omni,
    breakfast:[
      {name:"Bowl de avena con leche vegetal",items:[{name:"Avena en copos",grams:90,p:11.7,c:59.4,f:6.3,cat:"carb"},{name:"Leche de soja sin azúcar",grams:200,p:7,c:5,f:4,cat:"protein"},{name:"Plátano",grams:100,p:1,c:23,f:0.3,cat:"carb"},{name:"Mantequilla de cacahuete",grams:20,p:5.1,c:5.6,f:10.2,cat:"fat"}]},
      {name:"Tostadas con aguacate y edamame",items:[{name:"Pan integral tostado",grams:80,p:7.2,c:32.8,f:2.4,cat:"carb"},{name:"Aguacate",grams:100,p:2,c:9,f:15,cat:"fat"},{name:"Edamame cocido",grams:80,p:8.8,c:8,f:4,cat:"protein"}]},
    ],
    lunch:[
      {name:"Tofu salteado con arroz",items:[{name:"Tofu firme",grams:220,p:37.4,c:4.4,f:19.8,cat:"protein"},{name:"Arroz blanco cocido",grams:200,p:5.4,c:56,f:0.6,cat:"carb"},{name:"Brócoli salteado",grams:150,p:3.5,c:7,f:1,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
      {name:"Seitán con patata y ensalada",items:[{name:"Seitán a la plancha",grams:150,p:37.5,c:21,f:2.9,cat:"protein"},{name:"Patata cocida",grams:200,p:4,c:34,f:0.2,cat:"carb"},{name:"Ensalada variada",grams:150,p:1.5,c:5,f:0.3,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
    ],
    dinner:[
      {name:"Tempeh con quinoa y verduras",items:[{name:"Tempeh a la plancha",grams:180,p:34.2,c:16.2,f:19.8,cat:"protein"},{name:"Quinoa cocida",grams:180,p:7.9,c:39.6,f:3.4,cat:"carb"},{name:"Espinacas y tomate",grams:150,p:2,c:5,f:0.4,cat:"veg"},{name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"}]},
    ],
  };
  if(dietType==="keto") return {
    breakfast:[
      {name:"Huevos con bacon y aguacate",items:[
        {name:"Huevos enteros",grams:180,p:21.6,c:1.8,f:19.8,cat:"protein",note:"≈3 huevos"},
        {name:"Bacon / panceta",grams:60,p:7.2,c:0,f:25.2,cat:"fat"},
        {name:"Aguacate",grams:100,p:2,c:2,f:15,cat:"fat"},
        {name:"Café solo o con nata",grams:0,p:0,c:0,f:0,cat:"veg",note:"sin límite"},
      ]},
      {name:"Tortilla de queso y jamón",items:[
        {name:"Huevos enteros",grams:180,p:21.6,c:1.8,f:19.8,cat:"protein",note:"≈3 huevos"},
        {name:"Queso curado rallado",grams:40,p:10,c:0.2,f:13.2,cat:"fat"},
        {name:"Jamón serrano",grams:50,p:12,c:0,f:3,cat:"protein"},
        {name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"},
      ]},
      {name:"Yogur griego con frutos secos",items:[
        {name:"Yogur griego 0%",grams:200,p:20,c:8,f:0.6,cat:"protein"},
        {name:"Nueces de macadamia",grams:30,p:2.4,c:1.5,f:22.8,cat:"fat"},
        {name:"Almendras",grams:20,p:4.2,c:0.8,f:9.8,cat:"fat"},
      ]},
    ],
    mid_morning:[
      {name:"Queso y frutos secos",items:[
        {name:"Queso curado",grams:60,p:15,c:0.3,f:19.8,cat:"protein"},
        {name:"Nueces",grams:30,p:4.5,c:4.2,f:19.5,cat:"fat"},
      ]},
      {name:"Aguacate con huevo duro",items:[
        {name:"Aguacate",grams:150,p:3,c:3,f:22.5,cat:"fat"},
        {name:"Huevos enteros",grams:120,p:14.4,c:1.2,f:13.2,cat:"protein",note:"≈2 huevos duros"},
      ]},
    ],
    lunch:[
      {name:"Salmón con espárragos y mantequilla",items:[
        {name:"Salmón a la plancha",grams:200,p:40,c:0,f:26,cat:"protein"},
        {name:"Espárragos salteados",grams:200,p:4.6,c:3.8,f:0.3,cat:"veg"},
        {name:"Mantequilla",grams:20,p:0.1,c:0,f:16.6,cat:"fat"},
        {name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"},
      ]},
      {name:"Pollo con brócoli y queso",items:[
        {name:"Pechuga de pollo a la plancha",grams:200,p:62,c:0,f:7.2,cat:"protein"},
        {name:"Brócoli al vapor",grams:200,p:7,c:7,f:0.8,cat:"veg"},
        {name:"Queso curado rallado",grams:40,p:10,c:0.2,f:13.2,cat:"fat"},
        {name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"},
      ]},
      {name:"Carne picada con pimientos",items:[
        {name:"Carne picada 20%",grams:200,p:36,c:0,f:40,cat:"protein"},
        {name:"Pimientos variados salteados",grams:150,p:1.5,c:6,f:0.5,cat:"veg"},
        {name:"Queso crema",grams:40,p:2.4,c:1.6,f:13.6,cat:"fat"},
        {name:"Aceite de oliva virgen extra",grams:10,p:0,c:0,f:10,cat:"fat"},
      ]},
    ],
    snack:[
      {name:"Sardinas con aceitunas",items:[
        {name:"Sardinas en aceite",grams:100,p:21,c:0,f:12,cat:"protein"},
        {name:"Aceitunas",grams:50,p:0.4,c:0.9,f:7.5,cat:"fat"},
      ]},
      {name:"Queso y jamón",items:[
        {name:"Queso curado",grams:60,p:15,c:0.3,f:19.8,cat:"protein"},
        {name:"Jamón serrano",grams:40,p:9.6,c:0,f:2.4,cat:"protein"},
      ]},
    ],
    dinner:[
      {name:"Solomillo con ensalada y aceite",items:[
        {name:"Solomillo de cerdo a la plancha",grams:200,p:42,c:0,f:10,cat:"protein"},
        {name:"Ensalada variada con pepino",grams:150,p:1.5,c:3,f:0.3,cat:"veg"},
        {name:"Aceite de oliva virgen extra",grams:15,p:0,c:0,f:15,cat:"fat"},
        {name:"Aguacate",grams:80,p:1.6,c:1.6,f:12,cat:"fat"},
      ]},
      {name:"Huevos revueltos con salmón ahumado",items:[
        {name:"Huevos enteros",grams:180,p:21.6,c:1.8,f:19.8,cat:"protein",note:"≈3 huevos"},
        {name:"Salmón ahumado",grams:80,p:18.4,c:0,f:6.4,cat:"protein"},
        {name:"Mantequilla",grams:15,p:0.1,c:0,f:12.5,cat:"fat"},
        {name:"Espinacas salteadas",grams:100,p:2.9,c:1.4,f:0.4,cat:"veg"},
      ]},
      {name:"Muslos de pollo con brócoli y nata",items:[
        {name:"Muslo de pollo con piel al horno",grams:200,p:48,c:0,f:28,cat:"protein"},
        {name:"Brócoli al vapor",grams:200,p:7,c:7,f:0.8,cat:"veg"},
        {name:"Nata para cocinar 35%",grams:50,p:1.1,c:1.4,f:17.5,cat:"fat"},
      ]},
    ],
    evening_snack:[
      {name:"Queso crema con nueces",items:[
        {name:"Queso crema",grams:80,p:4.8,c:3.2,f:27.2,cat:"fat"},
        {name:"Nueces de macadamia",grams:20,p:1.6,c:1,f:15.2,cat:"fat"},
      ]},
      {name:"Yogur griego con almendras",items:[
        {name:"Yogur griego 0%",grams:150,p:15,c:6,f:0.5,cat:"protein"},
        {name:"Almendras",grams:25,p:5.3,c:1,f:12.3,cat:"fat"},
      ]},
    ],
  };
  return omni;
}

function scaleMeal(template,tP){
  const baseP=template.items.reduce((s,i)=>s+i.p,0);
  const safeTp=(!tP||isNaN(tP)||tP<=0)?baseP:tP;
  const scale=Math.min(Math.max(baseP>0?safeTp/baseP:1,0.6),1.9);
  const items=template.items.map(item=>{
    const g=Math.max(10,Math.round(item.grams*scale/5)*5);
    const r=g/item.grams;
    return{...item,grams:g,p:Math.round(item.p*r)||0,c:Math.round(item.c*r)||0,f:Math.round(item.f*r)||0};
  });
  const totP=items.reduce((s,i)=>s+i.p,0);
  const totC=items.reduce((s,i)=>s+i.c,0);
  const totF=items.reduce((s,i)=>s+i.f,0);
  return{items,totP,totC,totF,kcal:(totP*4+totC*4+totF*9)||0};
}

function generateDietLocal(form,macros){
  const n=parseInt(form.mealsPerDay)||4;
  const schedule=getMealSchedule(form.trainTime||"afternoon",n);
  const templates=getFoodTemplates(form.dietType);
  const isKeto=form.dietType==="keto";

  // ── Protein distribution: foodProt (already suppProtein subtracted) split exactly
  // Pre/post workout meals get +20% protein, others get proportionally less
  // but total must equal foodProt exactly
  const prePostCount=schedule.filter(s=>(s.note||"").includes("pre")||(s.note||"").includes("post")).length;
  const normalCount=n-prePostCount;
  // x = base per normal meal, 1.2x = pre/post meal
  // normalCount*x + prePostCount*1.2x = foodProt
  const denomP2 = normalCount + prePostCount*1.2;
  const denomC2 = normalCount + prePostCount*1.3;
  const baseP = denomP2>0 ? (macros.foodProt||0)/denomP2 : (macros.foodProt||0)/n;

  // Carbs: similar boost at workout meals
  const baseCarbNormal = denomC2>0 ? (macros.carbs||0)/denomC2 : (macros.carbs||0)/n;

  const meals=schedule.map((slot,i)=>{
    const isPre=(slot.note||"").includes("pre"),isPost=(slot.note||"").includes("post");
    const tP=Math.round(isPre||isPost ? baseP*1.2 : baseP);
    const tC=Math.round(isPre||isPost ? baseCarbNormal*1.3 : baseCarbNormal);
    const typeOpts=templates[slot.type]||templates.snack||[];
    const template=typeOpts[i%typeOpts.length]||typeOpts[0];
    if(!template)return null;
    const scaled=scaleMeal(template,tP);
    return{name:slot.name,tag:isPre?"🏋️ PRE-ENTRENO":isPost?"⚡ POST-ENTRENO":"",plateName:template.name,slotType:slot.type,...scaled};
  }).filter(Boolean);

  // ── Verify totals and show accurate sum
  const totalPInMeals=meals.reduce((s,m)=>s+m.totP,0);
  const suppLines=[];
  if(form.wheyProtein){const pm=schedule.find(s=>(s.note||"").includes("post"));suppLines.push(`🥛 Batido proteína (${form.wheyGrams}g) → ${pm?`después de ${pm.name.toLowerCase()}`:"post-entreno"}`);}
  if(form.creatine)suppLines.push("💊 Creatina 5g → con el desayuno (la consistencia diaria > el momento exacto)");
  if(form.bcaa)suppLines.push("🔬 BCAAs/EAAs → intra-entreno o pre si entrenas en ayunas");
  if(form.other)suppLines.push(`➕ ${form.other} → con la comida principal`);
  const male=isMale(form.sex),age=parseInt(form.age);
  const tips=form.goal==="muscle"?[
    "📈 Pésate en ayunas cada semana. Objetivo: +0.25–0.5 kg/sem. Sin subida en 2 sem → añade 150 kcal en carbos.",
    age>=40?"🔑 A partir de los 40 la síntesis proteica cae — asegura ≥40g proteína por comida para superar el umbral de leucina.":"🔑 Nunca bajes de 30g proteína por comida para maximizar la síntesis proteica.",
    "⏰ 7–9h de sueño: el 70% de la GH se libera en sueño profundo. Sin recuperación no hay músculo.",
  ]:form.goal==="fat_loss"?[
    "📉 Objetivo: -0.5–0.75 kg/sem. Más rápido = pérdida muscular.",
    "🔑 Proteína alta (2.4g/kg) es lo más crítico en déficit para mantener músculo.",
    "🏋️ Mantén los pesos en el gym: la señal mecánica preserva la masa magra.",
  ]:[
    "⚖️ Pésate semanalmente. >0.5 kg/sem → reduce 100 kcal. Baja → sube 100 kcal.",
    "🔑 La consistencia semanal supera cualquier protocolo perfecto.",
    "📊 Fotos cada 2–4 sem: la báscula no refleja cambios de composición corporal.",
  ];
  return{meals,suppLines,tips};
}

const DAYS_ES=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

function generateWeeklyPlan(form,macros){
  // Generate 7 days rotating through all available templates with variety
  return DAYS_ES.map((day,dayIdx)=>{
    const n=parseInt(form.mealsPerDay)||4;
    const schedule=getMealSchedule(form.trainTime||"afternoon",n);
    const templates=getFoodTemplates(form.dietType);
    const prePostCount=schedule.filter(s=>(s.note||"").includes("pre")||(s.note||"").includes("post")).length;
    const normalCount=n-prePostCount;
    const denomP=normalCount+prePostCount*1.2;
    const denomC=normalCount+prePostCount*1.3;
    const baseP=denomP>0?(macros.foodProt||0)/denomP:(macros.foodProt||0)/n;
    const baseCarbNormal=denomC>0?(macros.carbs||0)/denomC:(macros.carbs||0)/n;
    const meals=schedule.map((slot,i)=>{
      const isPre=(slot.note||"").includes("pre"),isPost=(slot.note||"").includes("post");
      const tP=Math.round(isPre||isPost?baseP*1.2:baseP);
      const typeOpts=templates[slot.type]||templates.snack||[];
      // Rotate templates by dayIdx for variety
      const template=typeOpts[(i+dayIdx)%typeOpts.length]||typeOpts[0];
      if(!template)return null;
      const scaled=scaleMeal(template,tP);
      return{name:slot.name,tag:isPre?"🏋️ PRE-ENTRENO":isPost?"⚡ POST-ENTRENO":"",plateName:template.name,slotType:slot.type,...scaled};
    }).filter(Boolean);
    return{day,meals};
  });
}

// Alternative sources calculator
function getAlternatives(item,dietType){
  const cat=item.cat;
  if(cat==="veg"||cat==="sauce")return[];
  let pool=cat==="protein"
    ?(dietType==="keto"?PROTEIN_SOURCES_KETO:PROTEIN_SOURCES[dietType]||PROTEIN_SOURCES.omnivore)
    :cat==="carb"?CARB_SOURCES
    :(dietType==="keto"?FAT_SOURCES_KETO:FAT_SOURCES);
  const targetMacro=cat==="protein"?item.p:cat==="carb"?item.c:item.f;
  const macroKey=cat==="protein"?"p":cat==="carb"?"c":"f";
  return pool.filter(a=>a.name!==item.name&&(a[macroKey]||0)>0).map(alt=>{
    const grams=Math.max(10,Math.round((targetMacro/(alt[macroKey]/100))/5)*5);
    const r=grams/100;
    return{name:alt.name,emoji:alt.emoji||"",grams,p:Math.round(alt.p*r),c:Math.round(alt.c*r),f:Math.round(alt.f*r),note:alt.note||null,cat};
  }).slice(0,8);
}

// ─────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────

const C = {
  bg:           "#ede9e0",
  bgGrad:       "linear-gradient(160deg,#f0ece2 0%,#e4dfd3 100%)",
  card:         "#ffffff",
  surface:      "#f0ece4",
  surfaceAlt:   "#e8e4dc",
  // Primary
  indigo:       "#2d1f6e",
  indigoMid:    "#3d2d8f",
  indigoLight:  "#5b47c5",
  indigoGlow:   "rgba(61,45,143,0.18)",
  // Semantic — dark versions for text, mid for icons/accents
  green:        "#14532d",  greenMid:"#166534",  greenBg:"#dcfce7",  greenBorder:"#86efac",
  blue:         "#1e3a8a",  blueMid:"#1d4ed8",   blueBg:"#dbeafe",   blueBorder:"#93c5fd",
  amber:        "#78350f",  amberMid:"#92400e",  amberBg:"#fef3c7",  amberBorder:"#fcd34d",
  red:          "#7f1d1d",  redMid:"#991b1b",    redBg:"#fee2e2",    redBorder:"#fca5a5",
  purple:       "#3b0764",  purpleMid:"#6b21a8", purpleBg:"#ede9fe",  purpleBorder:"#c4b5fd",
  // Text — ALL high contrast on white
  text:         "#0d0d1a",   // near black — main body
  textSub:      "#1a1830",   // very dark — secondary
  textMuted:    "#2d2b3d",   // dark grey — still very readable
  textDim:      "#44415a",   // medium dark — labels, hints (no more light grey)
  // Borders & shadows
  border:       "rgba(0,0,0,0.1)",
  borderMed:    "rgba(0,0,0,0.15)",
  shadow:       "0 2px 8px rgba(0,0,0,0.07),0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:     "0 6px 20px rgba(0,0,0,0.09),0 2px 6px rgba(0,0,0,0.04)",
  shadowLg:     "0 16px 48px rgba(0,0,0,0.11),0 4px 12px rgba(0,0,0,0.06)",
  shadowIndigo: "0 6px 20px rgba(45,31,110,0.3),0 2px 6px rgba(45,31,110,0.2)",
};

function Input({value,onChange,type="text",placeholder,min,max,readOnly}){
  const [f,setF]=useState(false);
  return(
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} min={min} max={max} readOnly={readOnly}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}
      style={{
        width:"100%", boxSizing:"border-box",
        background: readOnly ? C.surface : "#fff",
        border:`2px solid ${f ? C.indigoMid : C.border}`,
        borderRadius:"14px", padding:"0.85rem 1rem",
        color: readOnly ? C.textMuted : C.text,
        fontFamily:"system-ui,sans-serif", fontSize:"1.05rem", fontWeight:"600",
        outline:"none", transition:"all 0.18s",
        boxShadow: f ? `0 0 0 4px ${C.indigoGlow}` : C.shadow,
      }}
    />
  );
}

function Chip({label,active,onClick,color,bg,border}){
  const ac=color||C.indigoMid, abg=bg||"rgba(61,45,143,0.08)", aborder=border||C.indigoMid;
  return(
    <button onClick={onClick} style={{
      padding:"0.55rem 1.1rem", borderRadius:"12px",
      border: active ? `2px solid ${aborder}` : `2px solid ${C.border}`,
      background: active ? abg : "#fff",
      color: active ? ac : C.textSub,
      fontFamily:"system-ui,sans-serif", fontSize:"0.88rem",
      fontWeight: active ? "700" : "500",
      cursor:"pointer", transition:"all 0.14s",
      marginRight:"0.45rem", marginBottom:"0.45rem",
      boxShadow: active ? "none" : C.shadow,
      letterSpacing:"-0.01em",
    }}>{label}</button>
  );
}

function Toggle({label,checked,onChange,sub}){
  return(
    <div onClick={()=>onChange(!checked)} style={{
      display:"flex", alignItems:"flex-start", gap:"0.9rem",
      padding:"1rem 1.1rem",
      background: checked ? "#f4f2ff" : "#fff",
      borderRadius:"16px",
      border:`2px solid ${checked ? C.indigoMid : C.border}`,
      marginBottom:"0.7rem", cursor:"pointer", transition:"all 0.18s",
      boxShadow: checked ? `0 4px 14px ${C.indigoGlow}` : C.shadow,
    }}>
      <div style={{
        width:"22px",height:"22px",borderRadius:"7px",flexShrink:0,marginTop:"2px",
        background: checked ? C.indigo : "#f0edf8",
        border: checked ? "none" : `2px solid ${C.border}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        transition:"all 0.18s",
        boxShadow: checked ? `0 2px 8px ${C.indigoGlow}` : "none",
      }}>
        {checked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <div>
        <div style={{color:C.text,fontSize:"0.93rem",fontWeight:"700"}}>{label}</div>
        {sub&&<div style={{color:C.textMuted,fontSize:"0.73rem",marginTop:"0.15rem"}}>{sub}</div>}
      </div>
    </div>
  );
}

function Field({label,hint,children}){
  return(
    <div style={{marginBottom:"1.3rem"}}>
      <label style={{display:"block",fontSize:"0.68rem",letterSpacing:"0.1em",textTransform:"uppercase",color:C.textSub,marginBottom:"0.4rem",fontWeight:"700"}}>{label}</label>
      {hint&&<p style={{fontSize:"0.72rem",color:C.textSub,marginBottom:"0.45rem",marginTop:0}}>{hint}</p>}
      {children}
    </div>
  );
}

function Btn({onClick,children,secondary,disabled,variant,small}){
  const [p,setP]=useState(false);
  const h={onMouseDown:()=>setP(true),onMouseUp:()=>setP(false),onMouseLeave:()=>setP(false),onTouchStart:()=>setP(true),onTouchEnd:()=>setP(false)};
  const base={
    display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"0.4rem",
    padding: small?"0.45rem 0.85rem":"1rem 2rem",
    borderRadius:"14px",
    fontFamily:"system-ui,sans-serif",
    fontSize: small?"0.76rem":"0.95rem",
    letterSpacing:"-0.01em",
    cursor: disabled?"not-allowed":"pointer",
    fontWeight:"700",outline:"none",border:"none",
    transition:"all 0.14s",userSelect:"none",
  };
  if(disabled) return(<button disabled style={{...base,background:C.surfaceAlt,color:C.textMuted}}>{children}</button>);
  if(secondary) return(
    <button onClick={onClick} {...h} style={{...base,background:p?"#ece9e0":"#fff",color:C.text,border:`2px solid ${C.borderMed}`,transform:p?"scale(0.98)":"scale(1)",boxShadow:p?"none":C.shadow}}>{children}</button>
  );
  if(variant==="ghost") return(
    <button onClick={onClick} {...h} style={{...base,background:p?"rgba(61,45,143,0.1)":"rgba(61,45,143,0.07)",color:C.indigoMid,border:`1.5px solid rgba(61,45,143,0.2)`,padding:small?"0.35rem 0.7rem":"0.5rem 1rem",fontSize:"0.74rem",borderRadius:"9px",transform:p?"scale(0.97)":"scale(1)",fontWeight:"600"}}>{children}</button>
  );
  // Primary — full-width feel, deep indigo
  return(
    <button onClick={onClick} {...h} style={{...base,
      background: p ? C.indigo : C.indigoMid,
      color:"#fff",
      boxShadow: p?"none":C.shadowIndigo,
      transform: p?"translateY(1px) scale(0.99)":"translateY(0) scale(1)",
    }}>{children}</button>
  );
}

function ProgressBar({step}){
  const pct=(step/(stepTitles.length-1))*100;
  return(
    <div style={{marginBottom:"1.75rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.6rem"}}>
        {stepTitles.map((t,i)=>(
          <span key={i} style={{
            fontSize:"0.56rem",letterSpacing:"0.07em",textTransform:"uppercase",
            color: i<step ? "#166534" : i===step ? C.indigo : "#44415a",
            fontWeight: i===step?"800":i<step?"700":"500",
            transition:"color 0.3s",
          }}>{i<step?"✓ ":""}{t}</span>
        ))}
      </div>
      <div style={{background:"rgba(0,0,0,0.08)",borderRadius:"4px",height:"4px",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.indigo},${C.indigoLight})`,transition:"width 0.45s cubic-bezier(0.4,0,0.2,1)",borderRadius:"4px"}}/>
      </div>
    </div>
  );
}

// ── Step components ────────────────────────────────────────────

function StepPersonal({form,set,estBF}){
  return(
    <>
      <Field label="Sexo biológico">
        <div style={{display:"flex",gap:"0.5rem"}}>
          {[{v:"male",l:"♂ Hombre"},{v:"female",l:"♀ Mujer"}].map(o=>(
            <Chip key={o.v} label={o.l} active={form.sex===o.v} onClick={()=>set("sex",o.v)}/>
          ))}
        </div>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.9rem"}}>
        <Field label="Edad"><Input type="number" value={form.age} onChange={v=>set("age",v)} placeholder="30"/></Field>
        <Field label="Peso (kg)"><Input type="number" value={form.weight} onChange={v=>set("weight",v)} placeholder="80"/></Field>
        <Field label="Altura (cm)"><Input type="number" value={form.height} onChange={v=>set("height",v)} placeholder="178"/></Field>
        <Field label="% Grasa" hint={estBF?`Estimado ~${estBF}%`:"Auto"}>
          <Input type="number" value={form.bodyFat} onChange={v=>set("bodyFat",v)} placeholder={estBF?String(estBF):"Auto"}/>
        </Field>
      </div>
      {estBF&&!form.bodyFat&&(
        <div style={{padding:"0.9rem 1rem",background:C.purpleBg,border:`2px solid ${C.purpleBorder}`,borderRadius:"14px",marginTop:"-0.3rem"}}>
          <p style={{margin:0,color:C.purpleMid,fontSize:"0.8rem",fontWeight:"600"}}>📊 Grasa estimada: <strong>{estBF}%</strong> · Fórmula Deurenberg. Puedes ajustarlo.</p>
        </div>
      )}
    </>
  );
}

function StepGoal({form,set}){
  const goals=[
    {v:"muscle",  icon:"💪",title:"Ganar músculo", desc:"Superávit · Proteína alta · Carbos elevados",          color:C.green, mid:C.greenMid, bg:C.greenBg,  border:C.greenBorder},
    {v:"maintain",icon:"⚖️",title:"Mantenimiento", desc:"Calorías mantenimiento · Composición estable",          color:C.blue,  mid:C.blueMid,  bg:C.blueBg,   border:C.blueBorder},
    {v:"fat_loss",icon:"🔥",title:"Perder grasa",  desc:"Déficit moderado · Proteína muy alta · Preservar músculo",color:C.amber, mid:C.amberMid, bg:C.amberBg,  border:C.amberBorder},
  ];
  return(
    <>
      {goals.map(g=>(
        <div key={g.v} onClick={()=>set("goal",g.v)} style={{
          padding:"1.2rem 1.25rem",borderRadius:"18px",cursor:"pointer",marginBottom:"0.75rem",
          border:`2px solid ${form.goal===g.v?g.mid:C.border}`,
          background: form.goal===g.v?g.bg:"#fff",
          transition:"all 0.18s",
          boxShadow: form.goal===g.v?`0 6px 20px ${g.mid}28`:C.shadow,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
            <div style={{width:"50px",height:"50px",borderRadius:"14px",background:form.goal===g.v?`${g.mid}22`:C.surface,border:`2px solid ${form.goal===g.v?g.mid+"40":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",flexShrink:0}}>{g.icon}</div>
            <div style={{flex:1}}>
              <div style={{color:form.goal===g.v?g.color:C.text,fontWeight:"800",fontSize:"1.02rem",letterSpacing:"-0.02em"}}>{g.title}</div>
              <div style={{color:form.goal===g.v?g.mid:C.textSub,fontSize:"0.77rem",marginTop:"0.2rem",fontWeight:"500"}}>{g.desc}</div>
            </div>
            {form.goal===g.v&&(
              <div style={{width:"26px",height:"26px",borderRadius:"50%",background:g.mid,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:`0 3px 10px ${g.mid}50`}}>
                <svg width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 3.5L3.5 6L9 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function StepTraining({form,set}){
  return(
    <>
      <Field label="Nivel">
        <div style={{display:"flex",flexWrap:"wrap"}}>
          {[{v:"beginner",l:"Principiante"},{v:"intermediate",l:"Intermedio"},{v:"advanced",l:"Avanzado"}].map(o=>(
            <Chip key={o.v} label={o.l} active={form.trainingLevel===o.v} onClick={()=>set("trainingLevel",o.v)}/>
          ))}
        </div>
      </Field>
      <Field label="Días / semana">
        <div style={{display:"flex",flexWrap:"wrap"}}>
          {[3,4,5,6].map(d=>(<Chip key={d} label={`${d} días`} active={form.trainingDays===String(d)} onClick={()=>set("trainingDays",String(d))}/>))}
        </div>
      </Field>
      <Field label="Hora de entreno">
        <div style={{display:"flex",flexWrap:"wrap"}}>
          {[{v:"morning",l:"☀️ Mañana"},{v:"midday",l:"🌤 Mediodía"},{v:"afternoon",l:"🌆 Tarde"},{v:"evening",l:"🌙 Noche"}].map(o=>(
            <Chip key={o.v} label={o.l} active={form.trainTime===o.v} onClick={()=>set("trainTime",o.v)}/>
          ))}
        </div>
      </Field>
      <Field label="Tipo de dieta">
        <div style={{display:"flex",flexWrap:"wrap"}}>
          {[{v:"omnivore",l:"Omnívora"},{v:"vegetarian",l:"Vegetariana"},{v:"vegan",l:"Vegana"},{v:"keto",l:"🥑 Keto"}].map(o=>(
            <Chip key={o.v} label={o.l} active={form.dietType===o.v} onClick={()=>set("dietType",o.v)}/>
          ))}
        </div>
      </Field>
      <Field label="Exclusiones / alergias" hint="Opcional">
        <Input value={form.allergies} onChange={v=>set("allergies",v)} placeholder="Ej: gluten, lácteos..."/>
      </Field>
    </>
  );
}

function StepMeals({form,set}){
  return(
    <>
      <Field label="Comidas al día" hint="Sin contar batidos de proteína">
        <div style={{display:"flex",flexWrap:"wrap"}}>
          {[3,4,5,6].map(n=>(<Chip key={n} label={`${n} comidas`} active={form.mealsPerDay===String(n)} onClick={()=>set("mealsPerDay",String(n))}/>))}
        </div>
      </Field>
      <div style={{padding:"1rem 1.1rem",background:C.blueBg,border:`2px solid ${C.blueBorder}`,borderRadius:"14px",marginTop:"0.5rem"}}>
        <p style={{color:C.blue,fontSize:"0.7rem",letterSpacing:"0.08em",textTransform:"uppercase",margin:"0 0 0.3rem",fontWeight:"800"}}>Distribución inteligente</p>
        <p style={{color:C.blueMid,fontSize:"0.83rem",margin:0,lineHeight:"1.6",fontWeight:"500"}}>Los carbohidratos se priorizan en pre y post-entreno para máximo rendimiento y recuperación.</p>
      </div>
    </>
  );
}

function StepSupplements({form,set}){
  return(
    <>
      <p style={{color:C.textSub,fontSize:"0.87rem",marginTop:0,marginBottom:"1.2rem",lineHeight:"1.65",fontWeight:"500"}}>La proteína de suplementos se descuenta de las comidas para un cálculo exacto.</p>
      <Toggle label="Proteína whey / vegetal en polvo" sub="Se resta de los macros de comida" checked={form.wheyProtein} onChange={v=>set("wheyProtein",v)}/>
      {form.wheyProtein&&(
        <div style={{marginLeft:"1rem",marginBottom:"1rem"}}>
          <Field label="Gramos proteína por batido">
            <Input type="number" value={form.wheyGrams} onChange={v=>set("wheyGrams",v)} placeholder="25"/>
          </Field>
        </div>
      )}
      <Toggle label="Creatina monohidrato 5g/día" sub="No afecta kcal ni macros" checked={form.creatine} onChange={v=>set("creatine",v)}/>
      <Toggle label="BCAAs / EAAs" sub="Aporte proteico marginal" checked={form.bcaa} onChange={v=>set("bcaa",v)}/>
      <Field label="Otros suplementos" hint="Opcional">
        <Input value={form.other} onChange={v=>set("other",v)} placeholder="Ej: omega-3, vitamina D, NMN..."/>
      </Field>
    </>
  );
}

function MacroCard({label,value,unit,color,mid,bg,border,sub}){
  return(
    <div style={{background:bg||"#fff",border:`2px solid ${border||C.border}`,borderRadius:"18px",padding:"1.1rem 0.5rem",textAlign:"center",boxShadow:C.shadow}}>
      <div style={{color:color,fontSize:"1.65rem",fontWeight:"900",lineHeight:1,letterSpacing:"-0.03em"}}>
        {value}<span style={{fontSize:"0.65rem",fontWeight:"700",opacity:0.6,marginLeft:"2px"}}>{unit}</span>
      </div>
      <div style={{color:mid||C.textSub,fontSize:"0.62rem",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:"0.35rem",fontWeight:"800"}}>{label}</div>
      {sub&&<div style={{color:mid||C.textSub,fontSize:"0.62rem",marginTop:"0.2rem",fontWeight:"600"}}>{sub}</div>}
    </div>
  );
}

function SwapModal({item,dietType,onSelect,onClose}){
  const alts=getAlternatives(item,dietType);
  const isP=item.cat==="protein",isC=item.cat==="carb";
  const catLabel=isP?"Fuentes de proteína":isC?"Fuentes de hidratos":"Fuentes de grasa";
  const col=isP?C.greenMid:isC?C.blueMid:C.amberMid;
  const bg=isP?C.greenBg:isC?C.blueBg:C.amberBg;
  const bdr=isP?C.greenBorder:isC?C.blueBorder:C.amberBorder;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(10,8,28,0.4)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:"520px",background:"#fff",borderRadius:"24px 24px 0 0",maxHeight:"78vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 -12px 48px rgba(0,0,0,0.14)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"1.3rem 1.4rem 1rem",borderBottom:`1.5px solid ${C.border}`,flexShrink:0}}>
          <div style={{width:"40px",height:"5px",background:"rgba(0,0,0,0.1)",borderRadius:"3px",margin:"0 auto 1.1rem"}}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.5rem"}}>
            <span style={{color:col,fontSize:"0.67rem",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:"800"}}>{catLabel}</span>
            <button onClick={onClose} style={{background:C.surface,border:`2px solid ${C.border}`,color:C.textMuted,width:"32px",height:"32px",borderRadius:"10px",cursor:"pointer",fontSize:"0.85rem",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"700"}}>✕</button>
          </div>
          <p style={{margin:0,color:C.text,fontSize:"0.96rem",fontWeight:"700",letterSpacing:"-0.02em"}}>Cambiando: <span style={{color:C.textMuted,fontWeight:"500"}}>{item.name}</span></p>
          <p style={{margin:"0.3rem 0 0",color:C.textMuted,fontSize:"0.74rem",fontWeight:"600"}}>Mismos {isP?"gramos de proteína":isC?"gramos de carbos":"gramos de grasa"} que el original</p>
        </div>
        <div style={{overflowY:"auto",padding:"0.75rem 1rem 2.5rem",flex:1}}>
          {alts.length===0?(
            <p style={{color:C.textMuted,textAlign:"center",padding:"2rem",fontSize:"0.85rem"}}>Sin alternativas disponibles</p>
          ):alts.map((alt,i)=>(
            <button key={i} onClick={()=>onSelect(alt)} style={{width:"100%",background:"#fff",border:`2px solid ${C.border}`,borderRadius:"16px",padding:"0.9rem 1rem",marginBottom:"0.5rem",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.75rem",transition:"all 0.15s",boxShadow:C.shadow}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=col;e.currentTarget.style.background=bg;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="#fff";}}
            >
              <div style={{display:"flex",alignItems:"center",gap:"0.75rem",flex:1}}>
                <div style={{width:"42px",height:"42px",borderRadius:"12px",background:bg,border:`2px solid ${bdr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem",flexShrink:0}}>{alt.emoji}</div>
                <div>
                  <div style={{color:C.text,fontSize:"0.92rem",fontWeight:"700",letterSpacing:"-0.01em"}}>{alt.name}</div>
                  {alt.note&&<div style={{color:col,fontSize:"0.68rem",marginTop:"0.1rem",fontWeight:"600"}}>👉 {alt.note}</div>}
                  <div style={{color:C.textMuted,fontSize:"0.72rem",marginTop:"0.2rem",fontWeight:"600"}}>P{alt.p}g · C{alt.c}g · G{alt.f}g</div>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{color:col,fontWeight:"900",fontSize:"1.15rem",letterSpacing:"-0.03em"}}>{alt.grams}g</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MealCard({meal, dietType, onItemSwap, done, doneSnap, onToggleDone, adjP, adjC, adjF, adjKcal}){
  const [open, setOpen] = useState(true);
  const [swapItem, setSwapItem] = useState(null);
  const isPre = meal.tag.includes("PRE"), isPost = meal.tag.includes("POST");
  const tagCol = isPre ? C.amberMid : isPost ? C.greenMid : "";
  const tagBg  = isPre ? C.amberBg  : isPost ? C.greenBg  : "";
  const tagBdr = isPre ? C.amberBorder : isPost ? C.greenBorder : "";

  // If done: grey overlay style
  const cardBg = done ? C.surface : (isPre||isPost) ? tagBg : "#fff";
  const cardBorder = done ? C.border : (isPre||isPost) ? tagBdr : C.border;

  return (
    <>
      {swapItem && (
        <SwapModal item={swapItem} dietType={dietType}
          onClose={()=>setSwapItem(null)}
          onSelect={alt=>{onItemSwap(meal,swapItem,alt);setSwapItem(null);}}
        />
      )}
      <div style={{background:cardBg, border:`2px solid ${cardBorder}`, borderRadius:"20px", marginBottom:"0.8rem", overflow:"hidden",
        boxShadow: done ? "none" : (isPre||isPost) ? `0 6px 20px ${tagCol}22` : C.shadow,
        opacity: done ? 0.7 : 1, transition:"opacity 0.2s",
      }}>
        <div style={{padding:"1rem 1.2rem", display:"flex", alignItems:"flex-start", gap:"0.75rem"}}>
          {/* Done toggle */}
          <button onClick={()=>onToggleDone(meal.name, adjP, adjC, adjF, adjKcal)} style={{
            width:"28px", height:"28px", borderRadius:"8px", flexShrink:0, marginTop:"4px",
            background: done ? C.greenMid : "#fff",
            border: `2px solid ${done ? C.greenMid : C.borderMed}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            cursor:"pointer", transition:"all 0.18s",
            boxShadow: done ? `0 2px 8px ${C.greenMid}40` : C.shadow,
          }}>
            {done && <svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1 4.5L5 8.5L12 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>

          {/* Header — clickable to expand */}
          <div style={{flex:1, cursor:"pointer"}} onClick={()=>setOpen(o=>!o)}>
            <div style={{display:"flex", alignItems:"center", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.3rem"}}>
              <span style={{color: done ? C.textMuted : C.textSub, fontSize:"0.62rem", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:"800",
                textDecoration: done ? "line-through" : "none"}}>{meal.name}</span>
              {meal.tag && <span style={{background:tagCol, color:"#fff", fontSize:"0.62rem", padding:"0.15rem 0.65rem", borderRadius:"20px", fontWeight:"800"}}>{meal.tag}</span>}
              {done && <span style={{background:C.greenMid, color:"#fff", fontSize:"0.6rem", padding:"0.1rem 0.55rem", borderRadius:"20px", fontWeight:"800"}}>✓ HECHA</span>}
              {adjP!=null && !done && <span style={{background:C.purpleMid, color:"#fff", fontSize:"0.6rem", padding:"0.1rem 0.55rem", borderRadius:"20px", fontWeight:"800"}}>↕ AJUSTADO</span>}
            </div>
            <div style={{color: done ? C.textMuted : C.text, fontSize:"1rem", fontWeight:"800", marginBottom:"0.3rem", letterSpacing:"-0.02em",
              textDecoration: done ? "line-through" : "none"}}>{meal.plateName}</div>
            <div style={{display:"flex", gap:"0.55rem", flexWrap:"wrap", alignItems:"center"}}>
              <span style={{color:C.textSub, fontSize:"0.72rem", fontWeight:"700"}}>
                {done && doneSnap ? doneSnap.kcal : adjKcal!=null ? adjKcal : meal.kcal} kcal
              </span>
              <span style={{width:"3px", height:"3px", borderRadius:"50%", background:C.textSub, display:"inline-block"}}/>
              <span style={{color:C.greenMid, fontSize:"0.72rem", fontWeight:"800"}}>
                P {done && doneSnap ? doneSnap.p : adjP!=null ? adjP : meal.totP}g
              </span>
              <span style={{color:C.blueMid,  fontSize:"0.72rem", fontWeight:"800"}}>
                C {done && doneSnap ? doneSnap.c : adjC!=null ? adjC : meal.totC}g
              </span>
              <span style={{color:C.amberMid, fontSize:"0.72rem", fontWeight:"800"}}>
                G {done && doneSnap ? doneSnap.f : adjF!=null ? adjF : meal.totF}g
              </span>
            </div>
            {!done && adjP!=null && (
              <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginTop:"0.3rem"}}>
                <span style={{fontSize:"0.6rem",fontWeight:"800",color:C.purpleMid,letterSpacing:"0.06em",textTransform:"uppercase"}}>↕ Objetivo ajustado</span>
                <span style={{fontSize:"0.6rem",color:C.textMuted,fontWeight:"600"}}>(original: P{meal.totP}g C{meal.totC}g G{meal.totF}g)</span>
              </div>
            )}
          </div>

          {/* Expand arrow */}
          <div onClick={()=>setOpen(o=>!o)} style={{width:"28px", height:"28px", borderRadius:"8px", background:C.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:C.textSub, fontSize:"0.65rem", fontWeight:"800", flexShrink:0, marginTop:"4px"}}>
            {open ? "▲" : "▼"}
          </div>
        </div>

        {open && !done && (
          <div style={{borderTop:`1.5px solid ${C.border}`, padding:"0.5rem 1.1rem 1rem"}}>
            {meal.items.map((item, i) => {
              const canSwap = item.cat && item.cat!=="veg" && item.cat!=="sauce";
              const ic  = item.cat==="protein" ? C.greenMid : item.cat==="carb" ? C.blueMid : item.cat==="fat" ? C.amberMid : C.textSub;
              const ibg = item.cat==="protein" ? C.greenBg  : item.cat==="carb" ? C.blueBg  : item.cat==="fat" ? C.amberBg  : C.surface;
              const ibdr= item.cat==="protein" ? C.greenBorder : item.cat==="carb" ? C.blueBorder : item.cat==="fat" ? C.amberBorder : "transparent";
              return (
                <div key={i} style={{display:"flex", alignItems:"center", gap:"0.6rem", padding:"0.65rem 0", borderBottom:i<meal.items.length-1?`1px solid ${C.border}`:"none"}}>
                  {canSwap && <div style={{width:"36px",height:"36px",borderRadius:"10px",background:ibg,border:`2px solid ${ibdr}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"1rem"}}>{item.cat==="protein"?"🥩":item.cat==="carb"?"🌾":"🥑"}</div>}
                  <div style={{flex:1}}>
                    <div style={{color:C.text, fontSize:"0.9rem", fontWeight:"700"}}>{item.name}</div>
                    {item.note && <div style={{color:C.purpleMid, fontSize:"0.68rem", marginTop:"0.1rem", fontWeight:"700"}}>👉 {item.note}</div>}
                    <div style={{color:ic, fontSize:"0.72rem", marginTop:"0.1rem", fontWeight:"700"}}>P{item.p} · C{item.c} · G{item.f}</div>
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:"0.45rem", flexShrink:0}}>
                    <span style={{color:"#fff", background:ic, fontWeight:"800", fontSize:"0.84rem", padding:"0.28rem 0.65rem", borderRadius:"9px", minWidth:"48px", textAlign:"center"}}>{item.grams}g</span>
                    {canSwap && <Btn variant="ghost" small onClick={()=>setSwapItem(item)}>🔄</Btn>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── Extra food tracker ─────────────────────────────────────────
function ExtraFoodTracker({extras, setExtras}){
  const [name, setName] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [open, setOpen] = useState(false);

  const add = () => {
    if (!name.trim()) return;
    const ep = parseFloat(p)||0, ec = parseFloat(c)||0, ef = parseFloat(f)||0;
    setExtras(prev => [...prev, {
      id: Date.now(), name: name.trim(),
      p: ep, c: ec, f: ef,
      kcal: ep*4+ec*4+ef*9,
    }]);
    setName(""); setP(""); setC(""); setF("");
  };

  const remove = id => setExtras(prev => prev.filter(e => e.id !== id));

  const totalE = extras.reduce((a,e)=>({p:a.p+e.p, c:a.c+e.c, f:a.f+e.f, kcal:a.kcal+e.kcal}), {p:0,c:0,f:0,kcal:0});

  const iStyle = {
    flex:1, background:"#fff", border:`2px solid ${C.border}`, borderRadius:"10px",
    padding:"0.6rem 0.7rem", color:C.text, fontFamily:"system-ui,sans-serif",
    fontSize:"0.88rem", fontWeight:"600", outline:"none", minWidth:0,
  };

  return (
    <div style={{background:"#fff", border:`2px solid ${C.border}`, borderRadius:"20px", marginBottom:"0.5rem", overflow:"hidden", boxShadow:C.shadow}}>
      {/* Header */}
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"1rem 1.2rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <div style={{display:"flex", alignItems:"center", gap:"0.75rem"}}>
          <div style={{width:"34px", height:"34px", borderRadius:"10px", background:C.purpleBg, border:`2px solid ${C.purpleBorder}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", flexShrink:0}}>➕</div>
          <div>
            <div style={{color:C.text, fontSize:"0.92rem", fontWeight:"800"}}>Extras / Picoteo</div>
            <div style={{color:C.textMuted, fontSize:"0.72rem", fontWeight:"600", marginTop:"0.1rem"}}>
              {extras.length===0 ? "Añade lo que hayas comido fuera del plan" : `${extras.length} extra${extras.length>1?"s":""} · P${Math.round(totalE.p)}g C${Math.round(totalE.c)}g G${Math.round(totalE.f)}g · ${Math.round(totalE.kcal)} kcal`}
            </div>
          </div>
        </div>
        <div style={{width:"28px",height:"28px",borderRadius:"8px",background:C.surface,display:"flex",alignItems:"center",justifyContent:"center",color:C.textSub,fontSize:"0.65rem",fontWeight:"800"}}>{open?"▲":"▼"}</div>
      </div>

      {open && (
        <div style={{borderTop:`1.5px solid ${C.border}`, padding:"1rem 1.2rem"}}>
          {/* Existing extras */}
          {extras.map(e => (
            <div key={e.id} style={{display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.5rem 0", borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1}}>
                <div style={{color:C.text, fontSize:"0.87rem", fontWeight:"700"}}>{e.name}</div>
                <div style={{fontSize:"0.7rem", fontWeight:"600", marginTop:"0.1rem"}}>
                  <span style={{color:C.greenMid}}>P{e.p}g</span> · <span style={{color:C.blueMid}}>C{e.c}g</span> · <span style={{color:C.amberMid}}>G{e.f}g</span>
                  <span style={{color:C.textMuted}}> · {e.kcal} kcal</span>
                </div>
              </div>
              <button onClick={()=>remove(e.id)} style={{background:C.redBg, border:`2px solid ${C.redBorder}`, color:C.redMid, width:"30px", height:"30px", borderRadius:"8px", cursor:"pointer", fontSize:"0.9rem", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"800", flexShrink:0}}>✕</button>
            </div>
          ))}

          {/* Add new */}
          <div style={{marginTop: extras.length>0 ? "0.9rem" : "0"}}>
            <div style={{marginBottom:"0.6rem"}}>
              <input value={name} onChange={e=>setName(e.target.value)}
                placeholder="Nombre del alimento o comida"
                style={{...iStyle, width:"100%", marginBottom:"0.6rem"}}
                onKeyDown={e=>e.key==="Enter"&&add()}
              />
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"0.5rem"}}>
                <div>
                  <div style={{fontSize:"0.62rem", fontWeight:"800", color:C.greenMid, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"0.3rem"}}>Proteína (g)</div>
                  <input type="number" value={p} onChange={e=>setP(e.target.value)} placeholder="0" min="0"
                    style={{...iStyle, width:"100%", textAlign:"center"}}/>
                </div>
                <div>
                  <div style={{fontSize:"0.62rem", fontWeight:"800", color:C.blueMid, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"0.3rem"}}>Carbos (g)</div>
                  <input type="number" value={c} onChange={e=>setC(e.target.value)} placeholder="0" min="0"
                    style={{...iStyle, width:"100%", textAlign:"center"}}/>
                </div>
                <div>
                  <div style={{fontSize:"0.62rem", fontWeight:"800", color:C.amberMid, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"0.3rem"}}>Grasas (g)</div>
                  <input type="number" value={f} onChange={e=>setF(e.target.value)} placeholder="0" min="0"
                    style={{...iStyle, width:"100%", textAlign:"center"}}/>
                </div>
              </div>
            </div>
            <button onClick={add} style={{
              width:"100%", padding:"0.75rem", borderRadius:"12px",
              background: name.trim() ? C.indigo : C.surfaceAlt,
              color: name.trim() ? "#fff" : C.textMuted,
              border:"none", cursor: name.trim() ? "pointer" : "not-allowed",
              fontSize:"0.88rem", fontWeight:"700", transition:"all 0.15s",
              boxShadow: name.trim() ? C.shadowIndigo : "none",
            }}>
              ➕ Añadir extra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Per-day tracker: doneMeals + extras independent per day ──
function DayTracker({dayIdx, meals, macros, dietType}){
  const [doneMeals, setDoneMeals] = useState(new Map());
  const [extras, setExtras] = useState([]);
  const [swapOpen, setSwapOpen] = useState(null);
  const [localMeals, setLocalMeals] = useState(meals);

  const extraTotals = extras.reduce((a,e)=>({p:a.p+e.p,c:a.c+e.c,f:a.f+e.f,kcal:a.kcal+e.kcal}),{p:0,c:0,f:0,kcal:0});
  const doneTotals = Array.from(doneMeals.values()).reduce((a,s)=>({p:a.p+s.p,c:a.c+s.c,f:a.f+s.f,kcal:a.kcal+s.kcal}),{p:0,c:0,f:0,kcal:0});
  const pending = localMeals.filter(m=>!doneMeals.has(m.name));
  const nP = pending.length;
  const remP = Math.max(0, macros.foodProt - Math.round(doneTotals.p) - Math.round(extraTotals.p));
  const remC = Math.max(0, macros.carbs    - Math.round(doneTotals.c) - Math.round(extraTotals.c));
  const remF = Math.max(0, macros.fat      - Math.round(doneTotals.f) - Math.round(extraTotals.f));
  const remK = Math.max(0, macros.kcal     - Math.round(doneTotals.kcal) - Math.round(extraTotals.kcal));
  const adjP = nP>0?Math.round(remP/nP):0;
  const adjC = nP>0?Math.round(remC/nP):0;
  const adjF = nP>0?Math.round(remF/nP):0;
  const adjK = nP>0?Math.round(remK/nP):0;
  const hasActivity = doneMeals.size>0 || extras.length>0;

  const toggleDone = (name, ap, ac, af, ak) => {
    setDoneMeals(prev=>{
      const m=new Map(prev);
      if(m.has(name)){m.delete(name);}
      else{
        const meal=localMeals.find(x=>x.name===name);
        m.set(name,{p:ap!=null?ap:meal.totP,c:ac!=null?ac:meal.totC,f:af!=null?af:meal.totF,kcal:ak!=null?ak:meal.kcal});
      }
      return m;
    });
  };

  const handleSwap = (meal,oldItem,newItem) => {
    setLocalMeals(prev=>prev.map(m=>{
      if(m.name!==meal.name)return m;
      const items=m.items.map(it=>it.name===oldItem.name?{...newItem}:it);
      const totP=items.reduce((s,i)=>s+i.p,0),totC=items.reduce((s,i)=>s+i.c,0),totF=items.reduce((s,i)=>s+i.f,0);
      return{...m,items,totP,totC,totF,kcal:totP*4+totC*4+totF*9};
    }));
  };

  return(
    <div>
      {/* Remaining panel */}
      {hasActivity && (
        <div style={{background:remK<100?C.greenBg:C.purpleBg,border:`2px solid ${remK<100?C.greenBorder:C.purpleBorder}`,borderRadius:"14px",padding:"0.85rem 1rem",marginBottom:"0.9rem"}}>
          <p style={{color:remK<100?C.green:C.purpleMid,fontSize:"0.62rem",letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:"800",margin:"0 0 0.5rem"}}>
            {remK<100?"🎯 Completado":`${nP} comida${nP!==1?"s":""} pendiente${nP!==1?"s":""}`}
          </p>
          {remK>=100&&nP>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.35rem",marginBottom:"0.5rem"}}>
              {[{l:"kcal",v:remK,c:C.purple},{l:"Prot",v:`${remP}g`,c:C.green},{l:"Carb",v:`${remC}g`,c:C.blue},{l:"Gras",v:`${remF}g`,c:C.amber}].map(x=>(
                <div key={x.l} style={{background:"#fff",borderRadius:"9px",padding:"0.5rem 0.3rem",textAlign:"center",border:`1.5px solid ${x.c}30`}}>
                  <div style={{color:x.c,fontSize:"1rem",fontWeight:"900",lineHeight:1}}>{x.v}</div>
                  <div style={{color:C.textMuted,fontSize:"0.55rem",fontWeight:"800",textTransform:"uppercase",marginTop:"0.2rem"}}>{x.l}</div>
                </div>
              ))}
            </div>
          )}
          {nP>0&&remK>=100&&<p style={{color:C.purpleMid,fontSize:"0.73rem",fontWeight:"700",margin:0}}>~{adjP}g P · ~{adjC}g C · ~{adjF}g G · ~{adjK} kcal por comida</p>}
        </div>
      )}

      {/* Extras */}
      <ExtraFoodTracker extras={extras} setExtras={setExtras}/>

      {/* Meals */}
      {localMeals.map((meal,i)=>(
        <MealCard key={i} meal={meal} dietType={dietType}
          onItemSwap={handleSwap}
          done={doneMeals.has(meal.name)}
          doneSnap={doneMeals.get(meal.name)}
          onToggleDone={toggleDone}
          adjP={hasActivity&&!doneMeals.has(meal.name)?adjP:null}
          adjC={hasActivity&&!doneMeals.has(meal.name)?adjC:null}
          adjF={hasActivity&&!doneMeals.has(meal.name)?adjF:null}
          adjKcal={hasActivity&&!doneMeals.has(meal.name)?adjK:null}
        />
      ))}
    </div>
  );
}

function WeeklyPlanView({weeklyPlan, dietType, macros}){
  return(
    <div>
      <p style={{color:C.textSub,fontSize:"0.63rem",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:"800",margin:"0 0 0.9rem"}}>
        PLAN SEMANAL — desliza para ver todos los días
      </p>
      {/* Horizontal scroll container */}
      <div style={{overflowX:"auto",marginLeft:"-1.75rem",marginRight:"-1.75rem",paddingLeft:"1.75rem",paddingBottom:"1rem"}}>
        <div style={{display:"flex",gap:"0.85rem",width:"max-content",paddingRight:"1.75rem"}}>
          {weeklyPlan.map((dayData,dayIdx)=>{
            const totP=dayData.meals.reduce((s,m)=>s+m.totP,0);
            const totC=dayData.meals.reduce((s,m)=>s+m.totC,0);
            const totF=dayData.meals.reduce((s,m)=>s+m.totF,0);
            const totK=dayData.meals.reduce((s,m)=>s+m.kcal,0);
            return(
              <div key={dayIdx} style={{width:"300px",flexShrink:0,background:C.surface,borderRadius:"18px",padding:"1.1rem",border:`2px solid ${C.border}`}}>
                {/* Day header */}
                <div style={{background:C.indigo,borderRadius:"12px",padding:"0.75rem 1rem",marginBottom:"1rem"}}>
                  <div style={{color:"#fff",fontWeight:"900",fontSize:"1rem",marginBottom:"0.25rem"}}>{dayData.day}</div>
                  <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                    <span style={{color:"rgba(255,255,255,0.75)",fontSize:"0.7rem",fontWeight:"700"}}>{totK} kcal</span>
                    <span style={{color:"#86efac",fontSize:"0.7rem",fontWeight:"800"}}>P{totP}g</span>
                    <span style={{color:"#93c5fd",fontSize:"0.7rem",fontWeight:"800"}}>C{totC}g</span>
                    <span style={{color:"#fcd34d",fontSize:"0.7rem",fontWeight:"800"}}>G{totF}g</span>
                  </div>
                </div>
                {/* Independent tracker per day */}
                <DayTracker dayIdx={dayIdx} meals={dayData.meals} macros={macros} dietType={dietType}/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResultStep({macros, dietData, setDietData, form}){
  const goalMap={
    muscle:  {label:"💪 Ganar músculo", color:C.green,  mid:C.greenMid,  bg:C.greenBg,  border:C.greenBorder},
    maintain:{label:"⚖️ Mantenimiento", color:C.blue,   mid:C.blueMid,   bg:C.blueBg,   border:C.blueBorder},
    fat_loss:{label:"🔥 Perder grasa",  color:C.amber,  mid:C.amberMid,  bg:C.amberBg,  border:C.amberBorder},
  };
  const g = goalMap[form.goal] || goalMap.maintain;
  const totalMeals = parseInt(form.mealsPerDay) || 4;

  const [view, setView] = useState("today");
  const weeklyPlan = useMemo(()=>generateWeeklyPlan(form,macros),[form,macros]);

  return (
    <>
      {/* View switcher */}
      <div style={{display:"flex",gap:"0.4rem",background:C.surface,borderRadius:"12px",padding:"0.3rem",marginBottom:"1.3rem"}}>
        {[{v:"today",l:"📋 Hoy"},  {v:"week",l:"📅 7 días"}].map(t=>(
          <button key={t.v} onClick={()=>setView(t.v)} style={{
            flex:1,padding:"0.6rem 0",borderRadius:"9px",border:"none",
            background:view===t.v?"#fff":C.surface,
            color:view===t.v?C.indigo:C.textMuted,
            fontSize:"0.82rem",fontWeight:view===t.v?"800":"600",
            cursor:"pointer",transition:"all 0.18s",
            boxShadow:view===t.v?C.shadow:"none",
          }}>{t.l}</button>
        ))}
      </div>

      {/* Goal + stats */}
      <div style={{display:"flex", alignItems:"center", gap:"0.65rem", marginBottom:"1.4rem", flexWrap:"wrap"}}>
        <span style={{padding:"0.4rem 1.1rem", borderRadius:"20px", background:g.bg, border:`2px solid ${g.border}`, color:g.color, fontSize:"0.82rem", fontWeight:"800"}}>{g.label}</span>
        <span style={{color:C.textMuted, fontSize:"0.75rem", fontWeight:"700"}}>{macros.bf}% grasa · {macros.lbm}kg masa magra</span>
      </div>

      {/* Macro totals */}
      <p style={{color:C.textSub, fontSize:"0.63rem", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.7rem", fontWeight:"800"}}>MACROS DIARIOS · TDEE {macros.tdee} kcal</p>
      <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"0.5rem", marginBottom:"1.1rem"}}>
        <MacroCard label="kcal"     value={macros.kcal}      unit=""  color={C.purple} mid={C.purpleMid} bg={C.purpleBg}  border={C.purpleBorder}/>
        <MacroCard label="Proteína" value={macros.totalProt} unit="g" color={C.green}  mid={C.greenMid}  bg={C.greenBg}   border={C.greenBorder} sub={macros.suppProtein>0?`${macros.foodProt}g comida`:""}/>
        <MacroCard label="Carbos"   value={macros.carbs}     unit="g" color={C.blue}   mid={C.blueMid}   bg={C.blueBg}    border={C.blueBorder}/>
        <MacroCard label="Grasas"   value={macros.fat}       unit="g" color={C.amber}  mid={C.amberMid}  bg={C.amberBg}   border={C.amberBorder}/>
      </div>

      {macros.suppProtein>0 && (
        <div style={{background:C.greenBg, border:`2px solid ${C.greenBorder}`, borderRadius:"12px", padding:"0.75rem 1rem", marginBottom:"1.1rem"}}>
          <p style={{color:C.green, fontSize:"0.8rem", fontWeight:"700", margin:0}}>
            🥛 Batido: <strong>{macros.suppProtein}g</strong> proteína · Comidas: <strong>{macros.foodProt}g</strong> · Total: <strong>{macros.totalProt}g</strong>
          </p>
        </div>
      )}

      {/* Today: plan header */}
      {view==="today" && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"1.5rem 0 0.8rem"}}>
          <p style={{color:C.textSub,fontSize:"0.63rem",letterSpacing:"0.1em",textTransform:"uppercase",margin:0,fontWeight:"800"}}>PLAN DE COMIDAS</p>
          <span style={{color:C.textMuted,fontSize:"0.7rem",fontWeight:"700"}}>🔄 cambiar · ✓ marcar</span>
        </div>
      )}

      {/* Today uses its own DayTracker */}
      {view==="today" && <DayTracker dayIdx={-1} meals={dietData.meals} macros={macros} dietType={form.dietType}/>}

      {/* Week view */}
      {view==="week" && <WeeklyPlanView weeklyPlan={weeklyPlan} dietType={form.dietType} macros={macros}/>}

      {/* Supplements */}
      {view==="today" && dietData.suppLines.length > 0 && (
        <>
          <p style={{color:C.textSub, fontSize:"0.63rem", letterSpacing:"0.1em", textTransform:"uppercase", margin:"1.5rem 0 0.8rem", fontWeight:"800"}}>SUPLEMENTACIÓN</p>
          <div style={{background:"#fff", border:`2px solid ${C.border}`, borderRadius:"18px", padding:"1rem 1.1rem", boxShadow:C.shadow}}>
            {dietData.suppLines.map((l,i)=>(<p key={i} style={{color:C.text, fontSize:"0.87rem", margin:i<dietData.suppLines.length-1?"0 0 0.65rem":"0", lineHeight:"1.65", fontWeight:"500"}}>{l}</p>))}
          </div>
        </>
      )}

      {view==="today" && <>
        <p style={{color:C.textSub, fontSize:"0.63rem", letterSpacing:"0.1em", textTransform:"uppercase", margin:"1.5rem 0 0.8rem", fontWeight:"800"}}>CONSEJOS PARA TU PERFIL</p>
        <div style={{background:"#fff", border:`2px solid ${C.border}`, borderRadius:"18px", padding:"1rem 1.1rem", boxShadow:C.shadow}}>
          {dietData.tips.map((t,i)=>(<p key={i} style={{color:C.text, fontSize:"0.87rem", margin:i<dietData.tips.length-1?"0 0 0.75rem":"0", lineHeight:"1.7", fontWeight:"500"}}>{t}</p>))}
        </div>
      </>}
    </>
  );
}


// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────

export default function App(){
  const [step,setStep]=useState(0);
  const [form,setForm]=useState(initialForm);
  const [macros,setMacros]=useState(null);
  const [dietData,setDietData]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const estBF=useMemo(()=>estimateBodyFat(form.sex,form.age,form.weight,form.height),[form.sex,form.age,form.weight,form.height]);

  const canNext=()=>{
    if(step===0)return form.sex&&form.age&&form.weight&&form.height;
    if(step===1)return !!form.goal;
    if(step===2)return form.trainingLevel&&form.trainingDays&&form.trainTime;
    if(step===3)return !!form.mealsPerDay;
    return true;
  };

  const handleNext=()=>{
    if(step===4){const m=calcMacros(form,estBF);const d=generateDietLocal(form,m);setMacros(m);setDietData(d);setStep(5);}
    else setStep(s=>s+1);
  };

  const reset=()=>{setStep(0);setForm(initialForm);setMacros(null);setDietData(null);};

  return(
    <div style={{minHeight:"100vh",background:C.bgGrad,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"2rem 1rem 3rem",fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box;} body{margin:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#e8e3d8;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:2px;}
        input::placeholder{color:#c0bbb0;font-weight:400;}
        input[type=number]::-webkit-inner-spin-button{opacity:0.3;}
      `}</style>

      <div style={{width:"100%",maxWidth:"540px"}}>

        {/* Header */}
        <div style={{marginBottom:"1.75rem",paddingLeft:"0.25rem"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:"0.5rem",background:"rgba(61,45,143,0.1)",border:"1.5px solid rgba(61,45,143,0.18)",borderRadius:"20px",padding:"0.35rem 0.9rem",marginBottom:"0.9rem"}}>
            <div style={{width:"6px",height:"6px",borderRadius:"50%",background:C.indigoMid}}/>
            <span style={{fontSize:"0.65rem",letterSpacing:"0.14em",textTransform:"uppercase",color:C.indigoMid,fontWeight:"800"}}>Nutrición · Culturismo</span>
          </div>
          <h1 style={{margin:"0 0 0.1rem",fontSize:"clamp(2rem,6vw,2.7rem)",fontWeight:"900",color:C.text,lineHeight:1.05,letterSpacing:"-0.04em"}}>Calculadora</h1>
          <h1 style={{margin:"0 0 0.6rem",fontSize:"clamp(2rem,6vw,2.7rem)",fontWeight:"900",color:C.indigoMid,lineHeight:1.05,letterSpacing:"-0.04em"}}>de Dieta Muscular</h1>
          <p style={{color:C.textMuted,fontSize:"0.87rem",margin:0,fontWeight:"500"}}>Plan personalizado · Macros exactos · Ingredientes intercambiables</p>
        </div>

        {/* Card */}
        <div style={{background:"#fff",borderRadius:"26px",padding:"1.75rem",boxShadow:C.shadowLg,border:`1.5px solid ${C.border}`}}>
          <ProgressBar step={step}/>

          {/* Step header */}
          <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"1.6rem"}}>
            <div style={{width:"30px",height:"30px",borderRadius:"10px",background:C.indigo,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 2px 8px ${C.indigoGlow}`}}>
              <span style={{color:"#fff",fontSize:"0.8rem",fontWeight:"900"}}>{step+1}</span>
            </div>
            <h2 style={{fontSize:"1rem",fontWeight:"800",letterSpacing:"-0.01em",color:C.text,margin:0}}>{stepTitles[step]}</h2>
          </div>

          {step===0&&<StepPersonal form={form} set={set} estBF={estBF}/>}
          {step===1&&<StepGoal form={form} set={set}/>}
          {step===2&&<StepTraining form={form} set={set}/>}
          {step===3&&<StepMeals form={form} set={set}/>}
          {step===4&&<StepSupplements form={form} set={set}/>}
          {step===5&&macros&&dietData&&<ResultStep macros={macros} dietData={dietData} setDietData={setDietData} form={form}/>}

          {/* Nav */}
          <div style={{marginTop:"1.75rem",paddingTop:"1.25rem",borderTop:`1.5px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:"0.75rem"}}>
            {step>0&&step<5
              ?<Btn secondary onClick={()=>setStep(s=>s-1)}>← Atrás</Btn>
              :step===5?<Btn secondary onClick={reset}>↺ Nuevo cálculo</Btn>:<div/>
            }
            {step<5&&(
              <Btn onClick={handleNext} disabled={!canNext()}
                style={canNext()?{flex:1}:{}}
              >{step===4?"Generar dieta →":"Siguiente →"}</Btn>
            )}
          </div>
        </div>

        <p style={{textAlign:"center",color:"rgba(0,0,0,0.35)",fontSize:"0.62rem",marginTop:"1.5rem",fontWeight:"600",letterSpacing:"0.06em",textTransform:"uppercase"}}>
          Katch-McArdle · Deurenberg BF · Ajustado por sexo, edad y objetivo
        </p>
      </div>
    </div>
  );
}
