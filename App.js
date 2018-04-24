/**
 * Izzulmakin
 * April 2018
 */
import React, { PureComponent, Children } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Button, Dimensions,
  KeyboardAvoidingView, Animated,
  AsyncStorage, 
} from 'react-native';

import { Buffer } from 'buffer';
import aesjs from 'aes-js';

// crypto-save physical sensor analog to digital generated secure random initial vector
const iv = [69, 187, 210, 105, 38, 42, 222, 28, 171, 150, 136, 234, 228, 139, 194, 50];

/**
 * generate 128-bit key from password with any length
 * @param {*string} password 
 */
function passwordToKey(password) {
  var buffer;
  buffer = Buffer.from(password.toString(), 'binary');
  buffer = Buffer.concat([buffer], 16); // padd to 16byte
  return [...buffer]; // to array
}

/** padd a text to have length of multiple of 16 bytes
 * @param length: length of text to be padded
 */
function makePadd(length) {
  const padding_char = ' ';
  return padding_char.repeat(
    ((length-1)|15)+1-length // closest upper multiplier of 16
  );
}

/**
 * Encrypt text string using password string with AES-CBC method
 * @param {*string} text 
 * @param {*string} password 
 * @return hexstring of encrypted text
 */
function encrypt(text, password) {
  console_log("to encrypt: ["+text+makePadd(text.length)+"]");
  var aesCbc = new aesjs.ModeOfOperation.cbc(passwordToKey(password), iv);
  var encryptedBytes = aesCbc.encrypt( 
    aesjs.utils.utf8.toBytes( // convert to bytes
      text+makePadd(text.length) // pad to multiplier of 16 length
    )
  );
  return aesjs.utils.hex.fromBytes(encryptedBytes); //convert to hexstring
}

/**
 * Decrypt hexstringEncryptedData (hex string) using password
 * @param {*} hexstringEncryptedData: a hexstring of encrypted bytes
 * @param {*} password: password used
 */
function decrypt(hexstringEncryptedData, password) {
  var aesCbc = new aesjs.ModeOfOperation.cbc(passwordToKey(password), iv);
  var encryptedBytes = aesjs.utils.hex.toBytes(hexstringEncryptedData);//hexstring to encrypted bytes
  var decryptedBytes = aesCbc.decrypt(encryptedBytes); //decrypt to bytes
  return aesjs.utils.utf8.fromBytes(decryptedBytes).trim();//from Bytes to string, trim trailing spaces
}


const windowW = Dimensions.get('window').width;
const windowH = Dimensions.get('window').height;
const passwordViewHeight = windowH/3;
const windowHmB = windowH - passwordViewHeight-20;
const topBarHeight = 30;

const db ={
  "encrypted_aaa": "@ANoteR:encrypted_aaa",
  "encrypted_data": "@ANoteR:encrypted_data",
};

const allow_log = true;
function console_log(x) {
  if (allow_log) console.log(x);
}





class FadeInView extends React.Component {
  state = {
    fadeAnim: new Animated.Value(0),  // Initial value for opacity: 0
  }

  componentDidMount() {
    let ftime = this.props.fadeInTime || 2000;
    Animated.timing(                  // Animate over time
      this.state.fadeAnim,            // The animated value to drive
      {
        toValue: 1,                   // Animate to opacity: 1 (opaque)
        duration: ftime,              // Make it take a while
      }
    ).start();                        // Starts the animation
  }

  render() {
    let { fadeAnim } = this.state;
    return (
      <Animated.View                 // Special animatable View
        style={{
          ...this.props.style,
          opacity: fadeAnim,         // Bind opacity to animated value
        }}
      >
        {this.props.children}
      </Animated.View>
    );
  }
}




class RoomPassword extends React.Component {
  /**
   * this.props.passwordLength
   */
  state = {
    input: [],
  };

  constructor() {
    super();
    this.buttonPressed = this.buttonPressed.bind(this);
  };

  componentDidMount() {
    this.setState({input: this.props.passwordWritten});
  };


  buttonPressed(buttonId) {
    this.setState((prevState, props) => {
      var _input = prevState.input;
      if (_input.length==props.passwordLength) {
        _input = _input.slice(1); //new copy of array and pop index 0
      }
      else {
        _input = _input.slice(0); //new copy array 
      }
      _input.push(buttonId);
      
      if (_input.length==props.passwordLength) {
        console_log("password set: "+_input);
        props.setPassword(_input);  // !! set password is here
      }
      
      return {input: _input};
    });
    console_log(this.state.input);
  }

  render() {
    let buttons = [];
    for (var i=1; i<=9; i=(i+1)) {
      const btId = i;
      buttons.push(
        <TouchableOpacity
          style={[styles.roomPasswordButton]}
          onPress={() => this.buttonPressed(btId)}
          key={btId}
        >
          <Text style={styles.buttonText}>{btId}</Text>
        </TouchableOpacity>
      );
    }
    buttons.push(
      <TouchableOpacity
        style={[styles.roomPasswordButton,styles.roomPasswordButton0]}
        onPress={() => this.buttonPressed(0)}
        key={0}
      >
        <Text style={styles.buttonText}>{0}</Text>
      </TouchableOpacity>
    )


    var textInfo = "Type your password";
    if (this.props.isNew) {
      textInfo = "Create new password (length: "+this.props.passwordLength+" digit)";
    }
    let textInfoView = (<Text style={{color: 'rgb(210,230,80)'}}>
      {textInfo} {this.props.additionalMessage}
    </Text>);

    return (

        <View style={styles.roomPassword}>
          <FadeInView
            style={{
              alignItems: 'center',
              width: windowW,
              justifyContent: 'center',
              paddingTop: 20,
              paddingBottom: 20,
              backgroundColor: 'rgb(23, 91, 114)'}}
            children={textInfoView}
            fadeInTime={400}
            />
          {buttons}
        </View>
    );
  };
};


class RoomNote extends React.Component {
  /**
   * props:
   * password: password string
   * encrypted_aaa: hexstring of encrypted "aaa"
   * encrypted_data: hexstring of encrypted data
   * onWrongPassword: callback when password is wrong, called by `onWrongPassword();`
   * saveMethod: called when saving to database `saveMethod(new_data_string);`
   */
  state = {
    decrypted_data: null,
    edited: false,
  };

  componentDidMount() {
    var decrypted_aaa = this.props.encrypted_aaa;
    var decrypted_data = this.props.encrypted_data;

      // check if password is correct
      console_log(this.props.encrypted_aaa);
      decrypted_aaa =  decrypt(this.props.encrypted_aaa, this.props.password);
      console_log("decrypted aaa is : "+decrypted_aaa);
      if (decrypted_aaa=="aaa") {
        // this.setState({passwordCorrect: true});
        // password correct, proceed to decrypting
        console_log("encrypted data: "+this.props.encrypted_data);
        var decrypted = decrypt(this.props.encrypted_data, this.props.password);
        console_log("decrypted data: "+decrypted);
        this.setState({decrypted_data:decrypted});
      }
      else {
        this.props.onWrongPassword();
        console_log("wrong password: "+this.props.password);
      }
  };

  render() {
    const fVactive = (1^this.state.edited);
    var saveButton = null;
    if (this.state.edited) {
      saveButton = (<View active={true}
        style={styles.roomNoteSave}>
        <TouchableOpacity
          onPress={()=>{
            this.props.saveMethod(this.state.decrypted_data);
            this.setState({edited: false})
          }}
          style={styles.roomNoteSaveTouchable}
        >
          <Text
          style={styles.roomNoteSaveTouchableText}>Save</Text>
        </TouchableOpacity>
      </View>);
    }

    return (
      <KeyboardAvoidingView style={styles.roomNote} >
        <TextInput
          style={styles.roomNoteText}
          editable={true}
          multiline={true}
          defaultValue={this.state.decrypted_data}
          onChangeText={(t) => this.setState({edited: true, decrypted_data: t})}
        />
        {saveButton}
      </KeyboardAvoidingView>
    );
  };

};

class RoomPasswordSetNewData extends React.Component {
  /**
   * just make newDB called once 
   * this.props.password
   * this.props.createNewData : method 
   */
  componentDidMount() {
    this.props.createNewData();
  }

  render() {
    return (
      <View
      style={{
        flexDirection: 'row',
      }}>
        <Text>Password set {this.props.password}</Text>
      </View>
    );
  };
};


export default class App extends React.Component {
  state = {
    password: 'loading',
    data: 'loading',
    passwordCorrect: false,
    inputPasswordAdditionalMessage: '',
    passwordWritten: [],
  };

  componentDidMount() {
    // this.dbEmpty();
    this.dbCreateTable();
  };

  onWrongPassword() {
    this.setState(
      (prevState, prop) => {
        return ({
          passwordCorrect: false,//redundant though
          passwordWritten: prevState.password,
          password: null,
          inputPasswordAdditionalMessage: 'Wrong password',
        });
      }
    );
  };

  render() {

    if (this.state.password=='loading' && this.state.data=='loading') {
      // wait while componentDidMount process transaction
      return (
        <View
        style={styles.container}>
          <Text>Loading data</Text>
        </View>
      );
    }
    else if (
      this.state.password!==null
      && this.state.password!="loading"
      && this.state.data!==null
      && this.state.data.encrypted_aaa!=undefined
      && this.state.data.encrypted_data!=undefined
    ) {
      // password set, data loaded

      return (
        <RoomNote
          encrypted_aaa={this.state.data.encrypted_aaa}
          encrypted_data={this.state.data.encrypted_data}
          password={this.state.password}
          saveMethod={(dataString) => {this.dbSaveData(dataString);}}
          onWrongPassword={() => {this.onWrongPassword();}}
        />
      );
    }
    else if (this.state.password!==null && this.state.data==null) {
      //password set, use it to create data
      return (
        <RoomPasswordSetNewData
         password={this.state.password}
         createNewData={() => this.dbNewData()}
        />
      );
    }
    else { //password is null
      //no password set and no data, means db is empty, create password to generate data in db
      if (this.state.data==null) {
        return (
            <RoomPassword passwordLength={6}
              isNew={true}
              additionalMessage={this.state.inputPasswordAdditionalMessage}
              passwordWritten={this.state.passwordWritten}
              setPassword={pw => this.setState({password:pw})}
            />
        );
      }
      //data loaded but no password set, ask for password
      return (
          <RoomPassword passwordLength={6}
            additionalMessage={this.state.inputPasswordAdditionalMessage}
            passwordWritten={this.state.passwordWritten}
            setPassword={pw => this.setState({password:pw})}
          />
      );
    }
  };

  dbCreateTable() {
    console_log("create table called");
    this.dbFetch();
  }

  dbEmpty() {
    //dbempty called
    AsyncStorage.setItem(db.encrypted_aaa, null);
  };


  dbFetch() {
    console_log("dbFetch is called");
    AsyncStorage.getItem(db.encrypted_aaa, (error, encrypted_aaa)=> {
      if (encrypted_aaa!=null) {
        console_log("data loaded, encrypted_aaa: "+encrypted_aaa);
        AsyncStorage.getItem(db.encrypted_data, (error, encrypted_data) => {
          if (encrypted_data!=null) {
            console_log("data loaded, encrypted_data: "+encrypted_data);
            this.setState({
              data: {"encrypted_aaa":encrypted_aaa, "encrypted_data":encrypted_data}
            });
          }
          else {
            console_log("data kosong, bikin baru (tapi password kesimpen)");
            this.setState({
              password: null,
              data: null
            });
          }
        });
      }
      else {
        console_log("data kosong, bikin baru");
        this.setState({
          password: null,
          data: null
        });
      }
    });
  };

  dbNewData() {
    ///password set but no data, generate and save in storage
    var encrypted_aaa = encrypt("aaa", this.state.password);
    var encrypted_data = encrypt("write data here", this.state.password);
    AsyncStorage.setItem(db.encrypted_aaa, encrypted_aaa).then(() => {
      AsyncStorage.setItem(db.encrypted_data, encrypted_data).then(()=>{
        this.dbFetch();
      });
    });
  };

  dbSaveData(dataString) {
    console_log("to encrypt: "+dataString);
    var encrypted_hexstring = encrypt(dataString, this.state.password);
    console_log("encrypted hexstring to save: "+encrypted_hexstring);
    AsyncStorage.setItem(db.encrypted_data, encrypted_hexstring).then(()=>{
      console_log("saved");
    });
  };

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: topBarHeight,
  },
  roomPassword: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f0f0f0',
    paddingTop: passwordViewHeight,
  },
  roomPasswordButton: {
    width: windowW/3,
    height: windowHmB/4,
    backgroundColor: '#FD276C',
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  roomPasswordButton0: {
    marginLeft: windowW/3
  },
  buttonText: {
    color: '#ffffff',
  },
  roomNote: {
    flex: 1,
    flexDirection: 'column',
    paddingTop: topBarHeight,
    width: windowW,
    backgroundColor: 'rgb(230,230,230)',
  },
  roomNoteText: {
    flex:  50,
    padding: 5,
  },
  roomNoteSave: {
    // flex: 1
  },
  roomNoteSaveTouchable: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8BC34A',
    height: 40,
  },
  roomNoteSaveTouchableText: {
    color: '#ffffff'
  },
  fadeViewContainer: {
    ...StyleSheet.absoluteFillObject,

    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
