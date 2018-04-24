import Expo, { SQLite } from 'expo';
import React, { PureComponent, Children } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Button, Dimensions,
  KeyboardAvoidingView, Animated,
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

const db = SQLite.openDatabase('db.db');


const windowW = Dimensions.get('window').width;
const windowH = Dimensions.get('window').height;
const passwordViewHeight = windowH/3;
const windowHmB = windowH - passwordViewHeight-20;


const allow_log = false;
function console_log(x) {
  if (allow_log) console.log(x);
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
        props.setPassword(_input);
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

    return (

        <View style={styles.roomPassword}>
          <Text style={{alignItems: 'center',width:windowW}} >
          {textInfo} {this.props.additionalMessage}
          </Text>
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
      <KeyboardAvoidingView style={styles.roomNote} behavior="padding">
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
      this.dbNewData();
      return (
        <View
        style={{
          flexDirection: 'row',
        }}>
          <Text>Password set {this.state.password}</Text>
        </View>
      );
    }
    else {
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
    db.transaction(tx => {
      tx.executeSql(
        'create table if not exists data (id integer primary key not null, encrypted_aaa string, encrypted_data string);',
        null,
        (tx,rs) => {
          this.dbFetch(tx);
        }
      );
    });
  }

  dbEmpty() {
    //dbempty called
    db.transaction((tx) => {
      tx.executeSql("delete from data where 1;")
    })
  };


  dbFetch(tx) {
    console_log("dbFetch is called");
    var proc = (tx) => {
      tx.executeSql(
        `select * from data where id = ?`,
        [1],
        (tx, resultSet) => {
          if (resultSet["rows"]["length"]>0) {
            this.setState({data: resultSet["rows"]["_array"][0]});
            console_log("ada");
          }
          else {
            console_log("data kosong, bikin baru");
            this.setState({
              password: null,
              data: null
            });
          }
        },
        (tx, err) => {
          console_log(err);
        }
      );
    };
    if (tx==null) {
      db.transaction(proc);
    }
    else {
      proc(tx);
    }
  };

  dbNewData() {
    var encrypted_aaa = encrypt("aaa", this.state.password);
    var encrypted_data = encrypt("write data here", this.state.password);
    
    db.transaction((tx) => {
      tx.executeSql(
        'insert into data (encrypted_aaa, encrypted_data) values (?, ?)',
        [
          encrypted_aaa,
          encrypted_data
        ],
        (tx, rs) => {
          this.dbFetch(tx);
        }
      );
      
    });

  };
  dbSaveData(dataString) {
    console_log("to encrypt: "+dataString);
    var encrypted_hexstring = encrypt(dataString, this.state.password);
    console_log("encrypted hexstring to save: "+encrypted_hexstring);

    db.transaction((tx) => {
      tx.executeSql(
        'UPDATE data SET encrypted_data = ? where id = ?;',
        [encrypted_hexstring, 1],
        (tx,rs) => {
          console_log("saved");
        },
        (tx, err) => {
          console_log("saving error: "+err)
        }
      )
    }
    );
  }

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Expo.Constants.statusBarHeight,
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
    paddingTop: Expo.Constants.statusBarHeight,
    height: windowH-Expo.Constants.statusBarHeight,
    width: windowW,
    backgroundColor: 'rgb(30,30,30)',
    color: 'rgb(152,220,254)',
  },
  roomNoteText: {
    flex:5,
    padding: 5,
  },
  roomNoteSave: {
    flex: 1
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
