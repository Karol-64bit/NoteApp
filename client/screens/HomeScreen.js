import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AddNote from './AddNote';

const HomeScreen = () => {
  const navigation = useNavigation();
  const [notes, setNotes] = useState([]);
  const [token, setToken] = useState("");


  const getToken = async () => {
    try {
      const value = await AsyncStorage.getItem("token");
      if (value !== null) {
        setToken(value);
      }
    } catch (error) {
      console.log(error);
    }
  };


  const removeToken = async () => {
    try {
      await AsyncStorage.removeItem("token");
      setToken("");
    } catch (error) {
      console.log(error);
    }
  };


  const fetchNotes = async () => {
    try {
      const response = await fetch("http://localhost:3000/notes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log(token)
      const data = await response.json();
      if (response.ok) {
        setNotes(data.notes);
      } else {
        console.log(data.error);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const addNewNote = async () =>{
    navigation.navigate("AddNote")
    await fetchNotes(); // Ponowne pobranie notatek po edycji notatki
  }


  useEffect(() => {
    getToken();
  }, []);

  useEffect(() => {
      fetchNotes();
  }, [token]);




  const deleteNote = async (noteId) => {
    try {
      const response = await fetch(`http://localhost:3000/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log(response)
      const data = await response.json();
      if (response.ok) {

        setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));
      } else {
        console.log(data.error);
      }
    } catch (error) {
      console.log(error);
    }
  };


  const logout = async () => {
    removeToken;
    navigation.navigate("LoginScreen");
  };

  const editNote = (note) => {
    navigation.navigate("EditNote",{note});
  }

  return (
    <View style={styles.container}>
      <Text>{token}</Text>
      {notes.map((note) => (
        <View key={note.id} style={styles.note}>
          <Text style={styles.noteTitle}>{note.title}</Text>
          <Text style={styles.noteContent}>{note.content}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => editNote(note)}
          >
            <Text style={styles.buttonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteNote(note.id)}
          >
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.button} onPress={addNewNote}>
        <Text style={styles.buttonText}>Add new note</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  note: {
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  noteContent: {
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: "#FF0000",
    borderRadius: 5,
    padding: 5,
    alignItems: "center",
    marginTop: 5,
  },
  editButton: {
    backgroundColor: "#00FF00",
    borderRadius: 5,
    padding: 5,
    alignItems: "center",
    marginTop: 5,
  },
  button: {
    backgroundColor: "#0782F9",
    width: "60%",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 40,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
