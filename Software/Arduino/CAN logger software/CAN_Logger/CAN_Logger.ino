/*
 * 
 * Data Logger for the ATN Battery Management System CAN messages
 * 
 * This program will store the BMS CAN messages in an SD card for later analysis.
 * 
 * Author: Abdulaziz Alahmadi
 * 
 * Latest Update: 25/03/2019
 */

#include <SD.h>
#include <SPI.h>
#include <mcp2515.h>

File file;

int sdModuleSSPin = 10;
int buad = 14;
int canClock = 1;
int filterMask = 0;

const int spiCSPin = 9;
int counterToStop = 0;
unsigned char Flag_Recv = 0;

struct can_frame canMsg;
MCP2515 CAN(spiCSPin);

void initializeSD()
{
  pinMode(sdModuleSSPin, OUTPUT);
  
  while (!SD.begin())
  {
    Serial.println("SD card initialization failed");
    Serial.println("Retrying... ");
    delay(50);
  }
  Serial.println("SD initialization done.");
  
}

int createFile(char filename[])
{
  file = SD.open(filename, FILE_WRITE);

  if (file)
  {
    return 1;
  } else
  {
    Serial.println("Error while creating file.");
    return 0;
  }
}

int writeToFile(char text[])
{
  if (file)
  {
    file.println(text);
    return 1;
  } else
  {
    return 0;
  }
}

int openFile(char filename[])
{
  file = SD.open(filename);
  if (file)
  {
    //serial.println("File opened with success!");
    return 1;
  } else
  {
    //serial.println("Error opening file...");
    return 0;
  }
}

String readLine()
{
  String received = "";
  char ch;
  while (file.available())
  {
    ch = file.read();
    if (ch == '\n')
    {
      //Serial.println(received);
      return String(received);
    }
    else
    {
      received += ch;
    }
  }
  return "";
}

void closeFile()
{
  if (file)
  {
    file.close();
  }
}

void readConfigFile(){
  String line = readLine();
  while(line != ""){
    int i;
    int switchCV = 0;
    String command;
    String value;
    
    for(i = 0; line[i] != '\0'; ++i);
    
    for(int index = 0; index < i; index++){
      if(line[index] == ' '){
        switchCV = 1;
        continue;
      }

      if(switchCV == 0){
        command += line[index];
      }else{
        value += line[index];
      }
      
    }
    Serial.print("Command: ");
    Serial.print(command);

    Serial.print(", ");

    Serial.print("Value: ");
    Serial.println(value);

    int valueLength = 0;
    int allDigit = 0;

    if(command[0] == 'B'){
       buad = value.toInt();
       if(buad < 1 | buad > 16){
        buad = 14;
       }else{
        buad = buad - 1;
       }
    }else if(command[0] == 'C'){
       canClock = value.toInt();
       if(canClock < 1 | canClock > 3){
        canClock = 1;
       }else{
        canClock = canClock - 1;
       }
    }else if(command[0] == 'F'){
       filterMask = value.toInt();
    }
    
    line = readLine();
  }
  closeFile();
}

void setup()
{

  Serial.begin(115200);
  SPI.begin();

  digitalWrite(spiCSPin,HIGH);

  initializeSD();

  if(!openFile("config.txt")){
    digitalWrite(sdModuleSSPin,HIGH);
    digitalWrite(spiCSPin,LOW);
  
    CAN.reset();
    //CAN_500KBPS MCP_16MHZ (ATN)
    //CAN_250KBPS MCP_20MHZ (QUT Motorsports)
    CAN.setBitrate(CAN_500KBPS, MCP_16MHZ);
    CAN.setNormalMode();
  }else{
    readConfigFile();
    CAN.reset();
    CAN.setBitrate(buad, canClock);
    if(filterMask != 0){
      CAN.setFilterMask(MCP2515::MASK0, true, filterMask);
    }
    CAN.setNormalMode();
  }

  digitalWrite(sdModuleSSPin,HIGH);
  digitalWrite(spiCSPin,LOW);
  
  Serial.println("------- CAN Read ----------");
  Serial.println("ID  DLC   DATA");
  
  //attachInterrupt(0, MCP2515_ISR, FALLING);

  sei();
}

void loop()
{

    digitalWrite(sdModuleSSPin,HIGH);
    digitalWrite(spiCSPin,LOW);
    
    if (CAN.readMessage(&canMsg) == MCP2515::ERROR_OK) {
      file = SD.open("can.txt", FILE_WRITE);
  
      Serial.print("0x");
      Serial.print(canMsg.can_id, HEX);

      file.print(canMsg.can_id, HEX);
      file.print(",");
      
      Serial.print(" ");
      
      Serial.print(canMsg.can_dlc, HEX); // print DLC
      file.print(canMsg.can_dlc, HEX);
      file.print(",");
      Serial.print(" ");
      
      for (int i = 0; i<canMsg.can_dlc; i++)  {  // print the data
          
        Serial.print(canMsg.data[i],HEX);
        Serial.print(" ");
  
        file.print(canMsg.data[i],HEX);
        if(i == canMsg.can_dlc - 1){
          file.print(",");
        }
  
      }
  
    Serial.println();
    file.println();
    file.close();
  }
  /*
  else{
      digitalWrite(spiCSPin,HIGH);
      digitalWrite(sdModuleSSPin,LOW);
  }
  */
}

/* Code Cemetery (Do not delete) *//*

  createFile("test.txt");
  writeToFile("This is sample text!9999999");
  closeFile();
  
  openFile("prefs.txt");
  //serial.println(readLine());
  //serial.println(readLine());
  closeFile();


  
  int openFile(char filename[])
  {
    file = SD.open(filename);
    if (file)
    {
      //serial.println("File opened with success!");
      return 1;
    } else
    {
      //serial.println("Error opening file...");
      return 0;
    }
  }
  

  String readLine()
  {
    String received = "";
    char ch;
    while (file.available())
    {
      ch = file.read();
      if (ch == '\n')
      {
        return String(received);
      }
      else
      {
        received += ch;
      }
    }
    return "";
  }
  
 */
