"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { type DisplacedPerson } from "@/lib/data";

interface SurveyData {
  // Basic Information
  enumerator_name: string;
  consent: boolean;
  state_of_origin: string;
  lga: string;
  wards: string;
  community: string;
  name_of_head_of_household: string;
  name_of_spouse: string;
  household_head_gender: string;
  age: number;
  residency_status: string;
  phone_number: string;
  marital_status: string;
  household_size: number;
  hh_size_score: number;

  // Shelter Information
  shelter_type: string;
  shelter_type_other: string;
  displacement_duration: string;
  affected_by_floods: boolean;
  flood_impacts: string[];
  flood_prone_area: boolean;
  previous_shelter_assistance: boolean;
  shelter_assistance_types: string[];
  shelter_assistance_other: string;

  // Basic Needs
  access_to_water_and_toilet: boolean;
  urgent_shelter_needs: string[];
  regular_income: boolean;
  main_livelihood: string[];
  main_livelihood_other: string;
  food_frequency: string;
  basic_needs_frequency: string;

  // Food Security (RCSI)
  rcsi_relied_on_less_preferred: number;
  rcsi_borrowed_food: number;
  rcsi_limited_portion_size: number;
  rcsi_restricted_adults: number;
  rcsi_reduced_meals: number;
  rcsi_total: number;
  rcsi_category: string;

  // Agriculture and Livelihood
  access_to_farmland: boolean;
  farmland_size: string;
  farming_support_needs: string[];
  farming_support_other: string;
  climate_smart_training: boolean;
  climate_smart_provider: string;
  monthly_income: number;
  regular_savings: boolean;
  savings_location: string;
  interested_in_silc: boolean;
  financial_training: boolean;
  preferred_livelihood_support: string;
  livelihood_support_other: string;

  // Skills and Training
  vocational_skills: string[];
  vocational_skills_other: string;
  practicing_skills: boolean;
  willing_to_attend_training: boolean;
  preferred_training: string[];
  training_other: string;

  // Education and Protection
  school_age_children_attend: boolean;
  reported_gbv: boolean;
  gbv_services_available: boolean;
  experienced_insecurity: boolean;
  feel_safe: boolean;

  // Urgent Needs
  urgent_needs: string[];
  urgent_needs_other: string;

  // Food Consumption Score
  fcs_rice_cereals: number;
  fcs_pulses: number;
  fcs_milk: number;
  fcs_meat: number;
  fcs_vegetables: number;
  fcs_fruits: number;
  fcs_sugar: number;
  fcs_oil: number;
  fcs_total: number;

  // Health and Community
  access_to_health_facility: boolean;
  chronic_illness: boolean;
  received_psychosocial_support: boolean;
  top_challenges: string;
  community_support_structures: string[];
  community_support_other: string;
  willing_participate_awareness: boolean;

  // Energy and Environment
  main_energy_source: string;
  energy_source_other: string;
  aware_clean_cooking: boolean;
  disaster_training: boolean;
  willing_participate_environmental: boolean;
  flood_risks: boolean;
  coping_strategies: string;

  // Assistance Preferences
  prefer_self_collection: boolean;
  assistance_recipient_name: string;
  passport_photo_url: string;

  // Metadata
  survey_date: string;
  gps_coordinates: string;
  device_id: string;
  submission_time: string;
}

interface DisplacedPersonSurveyProps {
  person?: DisplacedPerson | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const initialSurveyData: SurveyData = {
  enumerator_name: '',
  consent: false,
  state_of_origin: '',
  lga: '',
  wards: '',
  community: '',
  name_of_head_of_household: '',
  name_of_spouse: '',
  household_head_gender: '',
  age: 0,
  residency_status: '',
  phone_number: '',
  marital_status: '',
  household_size: 1,
  hh_size_score: 1,
  shelter_type: '',
  shelter_type_other: '',
  displacement_duration: '',
  affected_by_floods: false,
  flood_impacts: [],
  flood_prone_area: false,
  previous_shelter_assistance: false,
  shelter_assistance_types: [],
  shelter_assistance_other: '',
  access_to_water_and_toilet: false,
  urgent_shelter_needs: [],
  regular_income: false,
  main_livelihood: [],
  main_livelihood_other: '',
  food_frequency: '',
  basic_needs_frequency: '',
  rcsi_relied_on_less_preferred: 0,
  rcsi_borrowed_food: 0,
  rcsi_limited_portion_size: 0,
  rcsi_restricted_adults: 0,
  rcsi_reduced_meals: 0,
  rcsi_total: 0,
  rcsi_category: '',
  access_to_farmland: false,
  farmland_size: '',
  farming_support_needs: [],
  farming_support_other: '',
  climate_smart_training: false,
  climate_smart_provider: '',
  monthly_income: 0,
  regular_savings: false,
  savings_location: '',
  interested_in_silc: false,
  financial_training: false,
  preferred_livelihood_support: '',
  livelihood_support_other: '',
  vocational_skills: [],
  vocational_skills_other: '',
  practicing_skills: false,
  willing_to_attend_training: false,
  preferred_training: [],
  training_other: '',
  school_age_children_attend: false,
  reported_gbv: false,
  gbv_services_available: false,
  experienced_insecurity: false,
  feel_safe: false,
  urgent_needs: [],
  urgent_needs_other: '',
  fcs_rice_cereals: 0,
  fcs_pulses: 0,
  fcs_milk: 0,
  fcs_meat: 0,
  fcs_vegetables: 0,
  fcs_fruits: 0,
  fcs_sugar: 0,
  fcs_oil: 0,
  fcs_total: 0,
  access_to_health_facility: false,
  chronic_illness: false,
  received_psychosocial_support: false,
  top_challenges: '',
  community_support_structures: [],
  community_support_other: '',
  willing_participate_awareness: false,
  main_energy_source: '',
  energy_source_other: '',
  aware_clean_cooking: false,
  disaster_training: false,
  willing_participate_environmental: false,
  flood_risks: false,
  coping_strategies: '',
  prefer_self_collection: false,
  assistance_recipient_name: '',
  passport_photo_url: '',
  survey_date: new Date().toISOString().split('T')[0],
  gps_coordinates: '',
  device_id: '',
  submission_time: new Date().toISOString()
};

export default function DisplacedPersonSurvey({ person, isOpen, onOpenChange, onComplete }: DisplacedPersonSurveyProps) {
  const [surveyData, setSurveyData] = useState<SurveyData>(initialSurveyData);
  const [currentSection, setCurrentSection] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sections = [
    { title: "Consent & Basic Information", progress: 10 },
    { title: "Shelter & Displacement", progress: 20 },
    { title: "Basic Needs & Livelihood", progress: 30 },
    { title: "Food Security", progress: 40 },
    { title: "Agriculture & Income", progress: 50 },
    { title: "Skills & Training", progress: 60 },
    { title: "Protection & Education", progress: 70 },
    { title: "Health & Community", progress: 80 },
    { title: "Environment & Energy", progress: 90 },
    { title: "Assistance Preferences", progress: 100 }
  ];

  useEffect(() => {
    if (isOpen) {
      // Pre-fill some data from the person record if available
      setSurveyData(prev => ({
        ...prev,
        name_of_head_of_household: person?.name || '',
        survey_date: new Date().toISOString().split('T')[0]
      }));
    }
  }, [isOpen, person]);

  const calculateRCSI = () => {
    const total = surveyData.rcsi_relied_on_less_preferred +
                 surveyData.rcsi_borrowed_food +
                 surveyData.rcsi_limited_portion_size +
                 surveyData.rcsi_restricted_adults +
                 surveyData.rcsi_reduced_meals;
    let category = '';
    if (total <= 3) category = 'Low coping';
    else if (total <= 18) category = 'Medium coping';
    else category = 'High coping';

    setSurveyData(prev => ({
      ...prev,
      rcsi_total: total,
      rcsi_category: category
    }));
  };

  const calculateFCS = () => {
    const total = surveyData.fcs_rice_cereals +
                 surveyData.fcs_pulses +
                 surveyData.fcs_milk +
                 surveyData.fcs_meat +
                 surveyData.fcs_vegetables +
                 surveyData.fcs_fruits +
                 surveyData.fcs_sugar +
                 surveyData.fcs_oil;

    setSurveyData(prev => ({
      ...prev,
      fcs_total: total
    }));
  };

  useEffect(() => {
    calculateRCSI();
  }, [surveyData.rcsi_relied_on_less_preferred, surveyData.rcsi_borrowed_food,
      surveyData.rcsi_limited_portion_size, surveyData.rcsi_restricted_adults,
      surveyData.rcsi_reduced_meals]);

  useEffect(() => {
    calculateFCS();
  }, [surveyData.fcs_rice_cereals, surveyData.fcs_pulses, surveyData.fcs_milk,
      surveyData.fcs_meat, surveyData.fcs_vegetables, surveyData.fcs_fruits,
      surveyData.fcs_sugar, surveyData.fcs_oil]);

  const handleInputChange = (field: keyof SurveyData, value: any) => {
    setSurveyData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: keyof SurveyData, value: string) => {
    setSurveyData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).includes(value)
        ? (prev[field] as string[]).filter(item => item !== value)
        : [...(prev[field] as string[]), value]
    }));
  };

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSubmit = async () => {
    if (!surveyData.consent) {
      toast({ title: "Consent Required", description: "Participant must provide consent to continue.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let personId = person?.id;

      // If no person exists (new beneficiary registration), create one
      if (!personId) {
        const newPersonData = {
          name: surveyData.name_of_head_of_household,
          phone: surveyData.phone_number,
          details: `${surveyData.age} years old, ${surveyData.household_head_gender}`,
          status: 'Eligible for Shelter', // New status for survey-completed persons
          currentLocation: `${surveyData.community}, ${surveyData.lga}, ${surveyData.state_of_origin}`,
          destination: '',
          vulnerabilities: [],
          medicalNeeds: [],
          assistanceRequested: 'Completed beneficiary assessment survey',
          priority: surveyData.rcsi_category === 'High coping' ? 'High Priority' :
                   surveyData.rcsi_category === 'Medium coping' ? 'Medium Priority' : 'Low Priority',
          lastUpdate: new Date().toLocaleString(),
          surveyCompleted: true
        };

        const personRef = await addDoc(collection(db, 'displacedPersons'), newPersonData);
        personId = personRef.id;
      }

      // Save survey data
      const surveyRef = await addDoc(collection(db, 'displacedPersonSurveys'), {
        ...surveyData,
        personId: personId,
        submittedAt: new Date(),
        enumeratorId: 'current-user-id' // Replace with actual user ID
      });

      // Update person record to mark survey as completed and link survey
      await updateDoc(doc(db, 'displacedPersons', personId), {
        surveyCompleted: true,
        surveyId: surveyRef.id,
        status: 'Eligible for Shelter', // Ensure status is set for eligibility
        lastUpdate: new Date().toLocaleString()
      });

      toast({ title: "Beneficiary Registration Completed", description: "Survey data has been saved and person is now eligible for shelter assignment." });
      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving survey:', error);
      toast({ title: "Error", description: "Failed to save survey data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderSection = () => {
    switch (currentSection) {
      case 0: // Consent & Basic Information
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Enumerator Information</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="enumerator_name">Enumerator's Name</Label>
                  <Input
                    id="enumerator_name"
                    value={surveyData.enumerator_name}
                    onChange={(e) => handleInputChange('enumerator_name', e.target.value)}
                    required
                  />
                </div>
      case 1: // Shelter & Displacement
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Shelter Information</Label>
              <div className="space-y-2">
                <Label>What type of shelter is your household currently living in?</Label>
                <Select value={surveyData.shelter_type} onValueChange={(value) => handleInputChange('shelter_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shelter type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rented accommodation">Rented accommodation</SelectItem>
                    <SelectItem value="Own house (damaged but habitable)">Own house (damaged but habitable)</SelectItem>
                    <SelectItem value="Own house (undamaged)">Own house (undamaged)</SelectItem>
                    <SelectItem value="Makeshift shelter">Makeshift shelter</SelectItem>
                    <SelectItem value="Camp settlement">Camp settlement</SelectItem>
                    <SelectItem value="Other">Other (specify)</SelectItem>
                  </SelectContent>
                </Select>
                {surveyData.shelter_type === 'Other' && (
                  <Input
                    placeholder="Specify other shelter type"
                    value={surveyData.shelter_type_other}
                    onChange={(e) => handleInputChange('shelter_type_other', e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>How long has your household been displaced from your original home?</Label>
                <Select value={surveyData.displacement_duration} onValueChange={(value) => handleInputChange('displacement_duration', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Less than 6 months">Less than 6 months</SelectItem>
                    <SelectItem value="6 months to 1 year">6 months to 1 year</SelectItem>
                    <SelectItem value="1 to 2 years">1 to 2 years</SelectItem>
                    <SelectItem value="More than 2 years">More than 2 years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="affected_by_floods"
                    checked={surveyData.affected_by_floods}
                    onCheckedChange={(checked) => handleInputChange('affected_by_floods', !!checked)}
                  />
                  <Label htmlFor="affected_by_floods">Was your household affected by recent floods?</Label>
                </div>
              </div>

              {surveyData.affected_by_floods && (
                <div className="space-y-2">
                  <Label>If yes, what was the main impact?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'House destroyed', 'Farmland destroyed', 'Loss of property',
                      'Displacement', 'Health issues'
                    ].map(impact => (
                      <div key={impact} className="flex items-center space-x-2">
                        <Checkbox
                          id={`flood_${impact}`}
                          checked={surveyData.flood_impacts.includes(impact)}
                          onCheckedChange={() => handleArrayToggle('flood_impacts', impact)}
                        />
                        <Label htmlFor={`flood_${impact}`} className="text-sm">{impact}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flood_prone_area"
                    checked={surveyData.flood_prone_area}
                    onCheckedChange={(checked) => handleInputChange('flood_prone_area', !!checked)}
                  />
                  <Label htmlFor="flood_prone_area">Do you currently live in a flood-prone area?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="previous_shelter_assistance"
                    checked={surveyData.previous_shelter_assistance}
                    onCheckedChange={(checked) => handleInputChange('previous_shelter_assistance', !!checked)}
                  />
                  <Label htmlFor="previous_shelter_assistance">Has your household previously received shelter assistance?</Label>
                </div>
              </div>

              {surveyData.previous_shelter_assistance && (
                <div className="space-y-2">
                  <Label>What type of shelter assistance did you receive?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Cash-for-rent support', 'Shelter repair materials', 'Full shelter construction',
                      'Emergency tarpaulin/tent', 'Other (specify)'
                    ].map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`shelter_${type}`}
                          checked={surveyData.shelter_assistance_types.includes(type)}
                          onCheckedChange={() => handleArrayToggle('shelter_assistance_types', type)}
                        />
                        <Label htmlFor={`shelter_${type}`} className="text-sm">{type}</Label>
                      </div>
                    ))}
                  </div>
                  {surveyData.shelter_assistance_types.includes('Other (specify)') && (
                    <Input
                      placeholder="Specify other shelter assistance"
                      value={surveyData.shelter_assistance_other}
                      onChange={(e) => handleInputChange('shelter_assistance_other', e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 2: // Basic Needs & Livelihood
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Basic Needs Assessment</Label>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="access_to_water_and_toilet"
                    checked={surveyData.access_to_water_and_toilet}
                    onCheckedChange={(checked) => handleInputChange('access_to_water_and_toilet', !!checked)}
                  />
                  <Label htmlFor="access_to_water_and_toilet">Does your household have regular access to clean drinking water and a functional toilet or latrine?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>What are your household's most urgent shelter needs at the moment?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Roofing materials', 'Wall repair materials', 'Flooring materials',
                    'Doors and windows', 'Full reconstruction support', 'Rental support',
                    'Support for relocation to safer housing'
                  ].map(need => (
                    <div key={need} className="flex items-center space-x-2">
                      <Checkbox
                        id={`shelter_need_${need}`}
                        checked={surveyData.urgent_shelter_needs.includes(need)}
                        onCheckedChange={() => handleArrayToggle('urgent_shelter_needs', need)}
                      />
                      <Label htmlFor={`shelter_need_${need}`} className="text-sm">{need}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="regular_income"
                    checked={surveyData.regular_income}
                    onCheckedChange={(checked) => handleInputChange('regular_income', !!checked)}
                  />
                  <Label htmlFor="regular_income">Does your household have a regular source of income?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>What is the main source of livelihood for your household?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Farming or fishing', 'Petty trading or small business', 'Artisan or craftwork',
                    'Daily or casual labor', 'Formal employment', 'Support from relatives or remittances', 'None currently'
                  ].map(source => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={`livelihood_${source}`}
                        checked={surveyData.main_livelihood.includes(source)}
                        onCheckedChange={() => handleArrayToggle('main_livelihood', source)}
                      />
                      <Label htmlFor={`livelihood_${source}`} className="text-sm">{source}</Label>
                    </div>
                  ))}
                </div>
                {surveyData.main_livelihood.some(item => ![
                  'Farming or fishing', 'Petty trading or small business', 'Artisan or craftwork',
                  'Daily or casual labor', 'Formal employment', 'Support from relatives or remittances', 'None currently'
                ].includes(item)) && (
                  <Input
                    placeholder="Specify other livelihood source"
                    value={surveyData.main_livelihood_other}
                    onChange={(e) => handleInputChange('main_livelihood_other', e.target.value)}
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>How often does your household have enough food to eat?</Label>
                  <Select value={surveyData.food_frequency} onValueChange={(value) => handleInputChange('food_frequency', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Always">Always</SelectItem>
                      <SelectItem value="Often">Often</SelectItem>
                      <SelectItem value="Sometimes">Sometimes</SelectItem>
                      <SelectItem value="Rarely">Rarely</SelectItem>
                      <SelectItem value="Never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>How often is your household able to meet other basic needs such as clothing, transportation, and cooking fuel?</Label>
                  <Select value={surveyData.basic_needs_frequency} onValueChange={(value) => handleInputChange('basic_needs_frequency', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Always">Always</SelectItem>
                      <SelectItem value="Often">Often</SelectItem>
                      <SelectItem value="Sometimes">Sometimes</SelectItem>
                      <SelectItem value="Rarely">Rarely</SelectItem>
                      <SelectItem value="Never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      case 3: // Food Security
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Food Security Assessment (RCSI)</Label>
              <p className="text-sm text-muted-foreground">In the past 7 days, if your household did not have enough food or money to buy food, how many days did you...</p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Rely on less preferred and less expensive foods?</Label>
                  <Select value={surveyData.rcsi_relied_on_less_preferred.toString()} onValueChange={(value) => handleInputChange('rcsi_relied_on_less_preferred', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 days</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="4">4 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="6">6 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Borrow food or rely on help from a friend or relative?</Label>
                  <Select value={surveyData.rcsi_borrowed_food.toString()} onValueChange={(value) => handleInputChange('rcsi_borrowed_food', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 days</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="4">4 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="6">6 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Limit portion size at mealtimes?</Label>
                  <Select value={surveyData.rcsi_limited_portion_size.toString()} onValueChange={(value) => handleInputChange('rcsi_limited_portion_size', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 days</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="4">4 days</SelectItem>
      case 4: // Agriculture & Income
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Agriculture & Livelihood Support</Label>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="access_to_farmland"
                    checked={surveyData.access_to_farmland}
                    onCheckedChange={(checked) => handleInputChange('access_to_farmland', !!checked)}
                  />
                  <Label htmlFor="access_to_farmland">Does your household have access to farmland or fishing grounds?</Label>
                </div>
              </div>

              {surveyData.access_to_farmland && (
                <div className="space-y-2">
                  <Label>What is the size of the farmland available to you (in acres or plots)?</Label>
                  <Input
                    value={surveyData.farmland_size}
                    onChange={(e) => handleInputChange('farmland_size', e.target.value)}
                    placeholder="e.g., 2 acres, 5 plots"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>What kind of support would you need to improve your farming activities?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Seeds and other farming inputs', 'Farming tools or equipment', 'Fertilizer and pesticides',
                    'Irrigation or water access', 'Training on improved farming methods', 'Market linkage or access to buyers',
                    'Access to credit or financial support', 'Other (specify)'
                  ].map(support => (
                    <div key={support} className="flex items-center space-x-2">
                      <Checkbox
                        id={`farming_${support}`}
                        checked={surveyData.farming_support_needs.includes(support)}
                        onCheckedChange={() => handleArrayToggle('farming_support_needs', support)}
                      />
                      <Label htmlFor={`farming_${support}`} className="text-sm">{support}</Label>
                    </div>
                  ))}
                </div>
                {surveyData.farming_support_needs.includes('Other (specify)') && (
                  <Input
                    placeholder="Specify other farming support"
                    value={surveyData.farming_support_other}
                    onChange={(e) => handleInputChange('farming_support_other', e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="climate_smart_training"
                    checked={surveyData.climate_smart_training}
                    onCheckedChange={(checked) => handleInputChange('climate_smart_training', !!checked)}
                  />
                  <Label htmlFor="climate_smart_training">Have you or any member of your household received any training on Climate-Smart Agriculture (CSA) practices?</Label>
                </div>
              </div>

              {surveyData.climate_smart_training && (
                <div className="space-y-2">
                  <Label>Who provided the Climate-Smart Agriculture training?</Label>
                  <Input
                    value={surveyData.climate_smart_provider}
                    onChange={(e) => handleInputChange('climate_smart_provider', e.target.value)}
                    placeholder="e.g., Caritas, Government, NGO"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>What is your Household's Approximate monthly income (₦)</Label>
                <Input
                  type="number"
                  value={surveyData.monthly_income || ''}
                  onChange={(e) => handleInputChange('monthly_income', parseInt(e.target.value) || 0)}
                  placeholder="Enter amount in Naira"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="regular_savings"
                    checked={surveyData.regular_savings}
                    onCheckedChange={(checked) => handleInputChange('regular_savings', !!checked)}
                  />
                  <Label htmlFor="regular_savings">Do you currently save money regularly?</Label>
                </div>
              </div>

              {surveyData.regular_savings && (
                <div className="space-y-2">
                  <Label>Where do you usually save?</Label>
                  <Input
                    value={surveyData.savings_location}
                    onChange={(e) => handleInputChange('savings_location', e.target.value)}
                    placeholder="e.g., Bank, Cooperative, At home"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="interested_in_silc"
                    checked={surveyData.interested_in_silc}
                    onCheckedChange={(checked) => handleInputChange('interested_in_silc', !!checked)}
                  />
                  <Label htmlFor="interested_in_silc">Are you interested in joining a SILC (Savings and Internal Lending Community)?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="financial_training"
                    checked={surveyData.financial_training}
                    onCheckedChange={(checked) => handleInputChange('financial_training', !!checked)}
                  />
                  <Label htmlFor="financial_training">Have you received any financial literacy or business training before?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>What type of livelihood support would benefit your household the most?</Label>
                <Select value={surveyData.preferred_livelihood_support} onValueChange={(value) => handleInputChange('preferred_livelihood_support', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select support type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Start-up capital or small grant">Start-up capital or small grant</SelectItem>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                    <SelectItem value="Market access">Market access</SelectItem>
                    <SelectItem value="Other">Other (specify)</SelectItem>
                  </SelectContent>
                </Select>
                {surveyData.preferred_livelihood_support === 'Other' && (
                  <Input
                    placeholder="Specify other livelihood support"
                    value={surveyData.livelihood_support_other}
                    onChange={(e) => handleInputChange('livelihood_support_other', e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        );

      case 5: // Skills & Training
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Skills & Vocational Training</Label>

              <div className="space-y-2">
                <Label>What vocational or technical skills do you currently have?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Tailoring / Fashion design', 'Carpentry / Furniture making', 'Masonry / Construction work',
                    'Auto mechanics', 'Hairdressing / Beauty care', 'Catering / Food processing',
                    'Welding / Metal work', 'Electrical installation / Repair', 'ICT / Computer skills', 'Other (specify)'
                  ].map(skill => (
                    <div key={skill} className="flex items-center space-x-2">
                      <Checkbox
                        id={`skill_${skill}`}
                        checked={surveyData.vocational_skills.includes(skill)}
                        onCheckedChange={() => handleArrayToggle('vocational_skills', skill)}
                      />
                      <Label htmlFor={`skill_${skill}`} className="text-sm">{skill}</Label>
                    </div>
                  ))}
                </div>
                {surveyData.vocational_skills.includes('Other (specify)') && (
                  <Input
                    placeholder="Specify other skill"
                    value={surveyData.vocational_skills_other}
                    onChange={(e) => handleInputChange('vocational_skills_other', e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="practicing_skills"
                    checked={surveyData.practicing_skills}
                    onCheckedChange={(checked) => handleInputChange('practicing_skills', !!checked)}
                  />
                  <Label htmlFor="practicing_skills">Are you currently practicing any of these skill-based trades?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="willing_to_attend_training"
                    checked={surveyData.willing_to_attend_training}
                    onCheckedChange={(checked) => handleInputChange('willing_to_attend_training', !!checked)}
                  />
                  <Label htmlFor="willing_to_attend_training">Would you be willing to attend vocational or financial training to improve your livelihood?</Label>
                </div>
              </div>

              {surveyData.willing_to_attend_training && (
                <div className="space-y-2">
                  <Label>Which type of training are you most interested in?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Vocational or technical skills', 'Business or entrepreneurship', 'Financial literacy / savings management',
                      'Agriculture or livestock production', 'Digital / ICT skills', 'Other (specify)'
                    ].map(training => (
                      <div key={training} className="flex items-center space-x-2">
                        <Checkbox
                          id={`training_${training}`}
                          checked={surveyData.preferred_training.includes(training)}
                          onCheckedChange={() => handleArrayToggle('preferred_training', training)}
                        />
                        <Label htmlFor={`training_${training}`} className="text-sm">{training}</Label>
                      </div>
                    ))}
                  </div>
                  {surveyData.preferred_training.includes('Other (specify)') && (
                    <Input
                      placeholder="Specify other training interest"
                      value={surveyData.training_other}
                      onChange={(e) => handleInputChange('training_other', e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 6: // Protection & Education
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Protection & Education</Label>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="school_age_children_attend"
                    checked={surveyData.school_age_children_attend}
                    onCheckedChange={(checked) => handleInputChange('school_age_children_attend', !!checked)}
                  />
                  <Label htmlFor="school_age_children_attend">Do the school-age children in your household currently attend school?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="reported_gbv"
                    checked={surveyData.reported_gbv}
                    onCheckedChange={(checked) => handleInputChange('reported_gbv', !!checked)}
                  />
                  <Label htmlFor="reported_gbv">Are there reported cases of gender-based violence (GBV) in your household or community?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="gbv_services_available"
                    checked={surveyData.gbv_services_available}
                    onCheckedChange={(checked) => handleInputChange('gbv_services_available', !!checked)}
                  />
                  <Label htmlFor="gbv_services_available">Are GBV response or support services available in your area?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="experienced_insecurity"
                    checked={surveyData.experienced_insecurity}
                    onCheckedChange={(checked) => handleInputChange('experienced_insecurity', !!checked)}
                  />
                  <Label htmlFor="experienced_insecurity">Have you or your household experienced any insecurity or violence in the past 6 months?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="feel_safe"
                    checked={surveyData.feel_safe}
                    onCheckedChange={(checked) => handleInputChange('feel_safe', !!checked)}
                  />
                  <Label htmlFor="feel_safe">Do you feel safe in your community?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>What are your household's most urgent needs at the moment?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Food assistance', 'Shelter or housing support', 'Healthcare services', 'Water, sanitation, or hygiene items',
                    'Education support for children', 'Livelihood or income support', 'Protection or safety support', 'Other (specify)'
                  ].map(need => (
                    <div key={need} className="flex items-center space-x-2">
                      <Checkbox
                        id={`urgent_need_${need}`}
                        checked={surveyData.urgent_needs.includes(need)}
                        onCheckedChange={() => handleArrayToggle('urgent_needs', need)}
                      />
                      <Label htmlFor={`urgent_need_${need}`} className="text-sm">{need}</Label>
                    </div>
                  ))}
                </div>
                {surveyData.urgent_needs.includes('Other (specify)') && (
                  <Input
                    placeholder="Specify other urgent needs"
                    value={surveyData.urgent_needs_other}
                    onChange={(e) => handleInputChange('urgent_needs_other', e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        );

      case 7: // Health & Community
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Health & Community Support</Label>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="access_to_health_facility"
                    checked={surveyData.access_to_health_facility}
                    onCheckedChange={(checked) => handleInputChange('access_to_health_facility', !!checked)}
                  />
                  <Label htmlFor="access_to_health_facility">Do you have access to a health facility or healthcare provider nearby?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="chronic_illness"
                    checked={surveyData.chronic_illness}
                    onCheckedChange={(checked) => handleInputChange('chronic_illness', !!checked)}
                  />
                  <Label htmlFor="chronic_illness">Does any member of your household have a chronic illness or disability?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="received_psychosocial_support"
                    checked={surveyData.received_psychosocial_support}
                    onCheckedChange={(checked) => handleInputChange('received_psychosocial_support', !!checked)}
                  />
                  <Label htmlFor="received_psychosocial_support">Have you or any member of your household received psychosocial or counselling support in the past 12 months?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>What are the top three challenges affecting your community or location?</Label>
                <Textarea
                  value={surveyData.top_challenges}
                  onChange={(e) => handleInputChange('top_challenges', e.target.value)}
                  placeholder="List the main challenges..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>What community support structures are available in your area?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Community-based organization (CBO/CSO)', 'Religious or faith-based group', 'Youth group or association',
                    "Women's association or cooperative", 'GBV or protection committee', 'Traditional/community leadership', 'Other (specify)'
                  ].map(structure => (
                    <div key={structure} className="flex items-center space-x-2">
                      <Checkbox
                        id={`community_${structure}`}
                        checked={surveyData.community_support_structures.includes(structure)}
                        onCheckedChange={() => handleArrayToggle('community_support_structures', structure)}
                      />
                      <Label htmlFor={`community_${structure}`} className="text-sm">{structure}</Label>
                    </div>
                  ))}
                </div>
                {surveyData.community_support_structures.includes('Other (specify)') && (
                  <Input
                    placeholder="Specify other community support structure"
                    value={surveyData.community_support_other}
                    onChange={(e) => handleInputChange('community_support_other', e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="willing_participate_awareness"
                    checked={surveyData.willing_participate_awareness}
                    onCheckedChange={(checked) => handleInputChange('willing_participate_awareness', !!checked)}
                  />
                  <Label htmlFor="willing_participate_awareness">Would you be willing to participate in community awareness or prevention groups (e.g. GBV or peacebuilding)?</Label>
                </div>
              </div>
            </div>
          </div>
        );

      case 8: // Environment & Energy
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Environment & Energy</Label>

              <div className="space-y-2">
                <Label>What is your household's main source of energy for cooking?</Label>
                <Select value={surveyData.main_energy_source} onValueChange={(value) => handleInputChange('main_energy_source', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select energy source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Firewood">Firewood</SelectItem>
                    <SelectItem value="Charcoal">Charcoal</SelectItem>
                    <SelectItem value="Kerosene">Kerosene</SelectItem>
                    <SelectItem value="LPG">LPG</SelectItem>
                    <SelectItem value="Electricity">Electricity</SelectItem>
                    <SelectItem value="Other">Other (specify)</SelectItem>
                  </SelectContent>
                </Select>
                {surveyData.main_energy_source === 'Other' && (
                  <Input
                    placeholder="Specify other energy source"
                    value={surveyData.energy_source_other}
                    onChange={(e) => handleInputChange('energy_source_other', e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="aware_clean_cooking"
                    checked={surveyData.aware_clean_cooking}
                    onCheckedChange={(checked) => handleInputChange('aware_clean_cooking', !!checked)}
                  />
                  <Label htmlFor="aware_clean_cooking">Are you aware of energy-efficient or clean cooking methods (e.g., improved cookstoves, LPG)?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="disaster_training"
                    checked={surveyData.disaster_training}
                    onCheckedChange={(checked) => handleInputChange('disaster_training', !!checked)}
                  />
                  <Label htmlFor="disaster_training">Have you ever received training on disaster preparedness, environmental safety, or flood control?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="willing_participate_environmental"
                    checked={surveyData.willing_participate_environmental}
                    onCheckedChange={(checked) => handleInputChange('willing_participate_environmental', !!checked)}
                  />
                  <Label htmlFor="willing_participate_environmental">Would you be willing to participate in environmental safety or flood prevention activities in your community?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flood_risks"
                    checked={surveyData.flood_risks}
                    onCheckedChange={(checked) => handleInputChange('flood_risks', !!checked)}
                  />
                  <Label htmlFor="flood_risks">Are there flood risks in your area?</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>How does your household currently cope or protect itself from environmental hazards or disasters?</Label>
                <Textarea
                  value={surveyData.coping_strategies}
                  onChange={(e) => handleInputChange('coping_strategies', e.target.value)}
                  placeholder="Describe coping strategies..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 9: // Assistance Preferences
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Assistance Preferences</Label>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="prefer_self_collection"
                    checked={surveyData.prefer_self_collection}
                    onCheckedChange={(checked) => handleInputChange('prefer_self_collection', !!checked)}
                  />
                  <Label htmlFor="prefer_self_collection">If you are selected for assistance, do you prefer to come yourself?</Label>
                </div>
              </div>

              {!surveyData.prefer_self_collection && (
                <div className="space-y-2">
                  <Label>Name of the Person that will receive the assistance on your behalf</Label>
                  <Input
                    value={surveyData.assistance_recipient_name}
                    onChange={(e) => handleInputChange('assistance_recipient_name', e.target.value)}
                    placeholder="Enter recipient name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Passport Photograph of the person receiving assistance</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // In a real app, you'd upload this to storage and get a URL
                      handleInputChange('passport_photo_url', URL.createObjectURL(file));
                    }
                  }}
                />
                {surveyData.passport_photo_url && (
                  <img src={surveyData.passport_photo_url} alt="Passport photo" className="w-32 h-32 object-cover rounded-lg" />
                )}
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Thank you for your kind cooperation!</strong><br />
                  Your responses will help us determine your eligibility for further support to rebuild your lives.
                </p>
              </div>
            </div>
          </div>
        );
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="6">6 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Restrict consumption by adults so that small children can eat?</Label>
                  <Select value={surveyData.rcsi_restricted_adults.toString()} onValueChange={(value) => handleInputChange('rcsi_restricted_adults', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 days</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="4">4 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="6">6 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reduce the number of meals eaten in a day?</Label>
                  <Select value={surveyData.rcsi_reduced_meals.toString()} onValueChange={(value) => handleInputChange('rcsi_reduced_meals', parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 days</SelectItem>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="2">2 days</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="4">4 days</SelectItem>
                      <SelectItem value="5">5 days</SelectItem>
                      <SelectItem value="6">6 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="font-semibold">RCSI Score: {surveyData.rcsi_total}</p>
                <p className="text-sm">Category: {surveyData.rcsi_category}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-semibold">Food Consumption Score (FCS)</Label>
              <p className="text-sm text-muted-foreground">Please indicate the number of days (0–7) your household consumed the following food groups in the last 7 days.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rice, potatoes, other tubers, wheat, or other cereals</Label>
                    <Select value={surveyData.fcs_rice_cereals.toString()} onValueChange={(value) => handleInputChange('fcs_rice_cereals', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pulses, beans, or nuts</Label>
                    <Select value={surveyData.fcs_pulses.toString()} onValueChange={(value) => handleInputChange('fcs_pulses', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Milk or milk products</Label>
                    <Select value={surveyData.fcs_milk.toString()} onValueChange={(value) => handleInputChange('fcs_milk', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Meat, poultry, eggs, or fish</Label>
                    <Select value={surveyData.fcs_meat.toString()} onValueChange={(value) => handleInputChange('fcs_meat', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vegetables</Label>
                    <Select value={surveyData.fcs_vegetables.toString()} onValueChange={(value) => handleInputChange('fcs_vegetables', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fruits</Label>
                    <Select value={surveyData.fcs_fruits.toString()} onValueChange={(value) => handleInputChange('fcs_fruits', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sugar or honey</Label>
                    <Select value={surveyData.fcs_sugar.toString()} onValueChange={(value) => handleInputChange('fcs_sugar', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Oil, butter, or animal fat</Label>
                    <Select value={surveyData.fcs_oil.toString()} onValueChange={(value) => handleInputChange('fcs_oil', parseInt(value))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>{i} days</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <p className="font-semibold">FCS Score: {surveyData.fcs_total}</p>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Section not implemented yet</div>;
                <div className="space-y-2">
                  <Label htmlFor="survey_date">Date</Label>
                  <Input
                    id="survey_date"
                    type="date"
                    value={surveyData.survey_date}
                    onChange={(e) => handleInputChange('survey_date', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Consent</Label>
                <p className="text-sm text-muted-foreground">
                  Good morning. My name is {surveyData.enumerator_name || '[Enumerator Name]'}, from Caritas Nigeria, working on the Integrative Solutions for Humanitarian Housing Support Project. We are collecting information to understand your living conditions and household needs. Participation is voluntary, and you may stop at any time. Your information will be kept confidential and used only for project purposes. The interview will take about 10–15 minutes.
                </p>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="consent"
                    checked={surveyData.consent}
                    onCheckedChange={(checked) => handleInputChange('consent', !!checked)}
                  />
                  <Label htmlFor="consent">Do you agree to participate in this interview after the purpose has been explained to you?</Label>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label className="text-base font-semibold">Household Information</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state_of_origin">State of Origin</Label>
                  <Input
                    id="state_of_origin"
                    value={surveyData.state_of_origin}
                    onChange={(e) => handleInputChange('state_of_origin', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lga">LGA</Label>
                  <Input
                    id="lga"
                    value={surveyData.lga}
                    onChange={(e) => handleInputChange('lga', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wards">Wards</Label>
                  <Input
                    id="wards"
                    value={surveyData.wards}
                    onChange={(e) => handleInputChange('wards', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="community">Community</Label>
                  <Input
                    id="community"
                    value={surveyData.community}
                    onChange={(e) => handleInputChange('community', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name_of_head_of_household">Name of Head of Household</Label>
                  <Input
                    id="name_of_head_of_household"
                    value={surveyData.name_of_head_of_household}
                    onChange={(e) => handleInputChange('name_of_head_of_household', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name_of_spouse">Name of Spouse</Label>
                  <Input
                    id="name_of_spouse"
                    value={surveyData.name_of_spouse}
                    onChange={(e) => handleInputChange('name_of_spouse', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="household_head_gender">Household Head Gender</Label>
                  <Select value={surveyData.household_head_gender} onValueChange={(value) => handleInputChange('household_head_gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={surveyData.age || ''}
                    onChange={(e) => handleInputChange('age', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="residency_status">Residency Status</Label>
                  <Select value={surveyData.residency_status} onValueChange={(value) => handleInputChange('residency_status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Host">Host</SelectItem>
                      <SelectItem value="IDP">IDP</SelectItem>
                      <SelectItem value="Returnee">Returnee</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={surveyData.phone_number}
                    onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marital_status">Marital Status</Label>
                  <Select value={surveyData.marital_status} onValueChange={(value) => handleInputChange('marital_status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Divorced">Divorced</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                      <SelectItem value="Separated">Separated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="household_size">Household Size</Label>
                  <Select value={surveyData.household_size.toString()} onValueChange={(value) => {
                    const size = parseInt(value);
                    const score = size >= 1 && size <= 3 ? 1 : size >= 4 && size <= 6 ? 2 : 3;
                    handleInputChange('household_size', size);
                    handleInputChange('hh_size_score', score);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1–3 (1)</SelectItem>
                      <SelectItem value="4">4–6 (2)</SelectItem>
                      <SelectItem value="7">7+ (3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Section not implemented yet</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {person ? `Displaced Person Survey - ${person.name}` : 'Beneficiary Registration Form'}
          </DialogTitle>
          <DialogDescription>
            {person
              ? 'Comprehensive assessment for shelter assignment and support eligibility'
              : 'Complete beneficiary registration survey to determine eligibility for shelter and support programs'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{sections[currentSection].title}</span>
              <span>{currentSection + 1} of {sections.length}</span>
            </div>
            <Progress value={sections[currentSection].progress} className="w-full" />
          </div>

          <ScrollArea className="h-[60vh] pr-4">
            {renderSection()}
          </ScrollArea>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentSection === 0}
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {currentSection < sections.length - 1 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Submitting...' : 'Complete Survey'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}