// Lightweight entry to initialize store for examples/tests
import usePotionStore from './store/usePotionStore'
import data from './data/cauldrons.json'

usePotionStore.setState({ cauldrons: data })
